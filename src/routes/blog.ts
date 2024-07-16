import { Hono } from "hono";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { verify } from "hono/jwt";
import { commentRouter } from "./comment";
import { likeRouter } from "./like";
import { postBlogInput } from "@sagarkbk/blog-common";

export const blogRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
  Variables: {
    authorId: string;
  };
}>();

blogRouter.use("/*", async (c, next) => {
  try {
    const authHeader = c.req.header("authorization") || "";
    const user = await verify(authHeader, c.env.JWT_SECRET);
    if (user) {
      c.set("authorId", user.id as string);
      await next();
    } else {
      c.status(401);
      return c.json({
        success: false,
        data: null,
        message: "Unauthorized User",
      });
    }
  } catch (e) {
    console.log(e);
    c.status(500);
    return c.json({
      success: false,
      data: null,
      message: "Internal Server Issue",
    });
  }
});

blogRouter.route("/comment", commentRouter);
blogRouter.route("/like", likeRouter);

blogRouter.post("/saveAsDraft", async (c) => {
  let prisma;
  try {
    const body = await c.req.json();
    const inputValidation = postBlogInput.safeParse(body);
    if (!inputValidation.success) {
      c.status(400);
      return c.json({
        success: false,
        data: null,
        message: inputValidation.error.flatten().fieldErrors.title
          ? "Title : " + inputValidation.error.flatten().fieldErrors.title
          : inputValidation.error.flatten().fieldErrors.content
          ? "Content : " + inputValidation.error.flatten().fieldErrors.content
          : inputValidation.error.flatten().fieldErrors.tag
          ? "Tag : " + inputValidation.error.flatten().fieldErrors.tag
          : "Incorrect Inputs",
      });
    }
    const authorId = c.get("authorId");
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    const newBlog = await prisma.blog.create({
      data: {
        title: body.title,
        content: body.content,
        tag: body.tag ? body.tag.toLowerCase() : "",
        authorId: Number(authorId),
      },
    });
    c.status(201);
    return c.json({
      success: true,
      data: { blogId: newBlog.id },
      message: "Blog Saved as Draft",
    });
  } catch (e) {
    console.log(e);
    c.status(500);
    return c.json({
      success: false,
      data: null,
      message: "Internal Server Issue",
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});

blogRouter.post("/submit", async (c) => {
  let prisma;
  try {
    const body = await c.req.json();
    const inputValidation = postBlogInput.safeParse(body);
    if (!inputValidation.success) {
      c.status(400);
      return c.json({
        success: false,
        data: null,
        message: inputValidation.error.flatten().fieldErrors.title
          ? "Title : " + inputValidation.error.flatten().fieldErrors.title
          : inputValidation.error.flatten().fieldErrors.content
          ? "Content : " + inputValidation.error.flatten().fieldErrors.content
          : inputValidation.error.flatten().fieldErrors.tag
          ? "Tag : " + inputValidation.error.flatten().fieldErrors.tag
          : "Incorrect Inputs",
      });
    }
    const authorId = c.get("authorId");
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    const newBlog = await prisma.blog.create({
      data: {
        title: body.title,
        content: body.content,
        tag: body.tag ? body.tag.toLowerCase() : "",
        authorId: Number(authorId),
        published: true,
      },
    });
    c.status(201);
    return c.json({
      success: true,
      data: { blogId: newBlog.id },
      message: "Blog Created Successfully",
    });
  } catch (e) {
    console.log(e);
    c.status(500);
    return c.json({
      success: false,
      data: null,
      message: "Internal Server Issue",
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});

blogRouter.put("update/:blogId", async (c) => {
  let prisma;
  try {
    const body = await c.req.json();
    const inputValidation = postBlogInput.safeParse(body);
    if (!inputValidation.success) {
      c.status(400);
      return c.json({
        success: false,
        data: null,
        message: inputValidation.error.flatten().fieldErrors.title
          ? "Title : " + inputValidation.error.flatten().fieldErrors.title
          : inputValidation.error.flatten().fieldErrors.content
          ? "Content : " + inputValidation.error.flatten().fieldErrors.content
          : inputValidation.error.flatten().fieldErrors.tag
          ? "Tag : " + inputValidation.error.flatten().fieldErrors.tag
          : "Incorrect Inputs",
      });
    }
    const blogId = Number(c.req.param("blogId"));
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    const existingBlog = await prisma.blog.findUnique({
      where: {
        id: blogId,
      },
    });
    if (!existingBlog) {
      c.status(404);
      return c.json({
        success: false,
        data: null,
        message: "Blog Not Found",
      });
    }
    const updatedBlog = await prisma.blog.update({
      where: {
        id: blogId,
      },
      data: {
        title: body.title,
        content: body.content,
        tag: body.tag ? body.tag.toLowerCase() : "",
        updatedAt: new Date(),
      },
    });
    c.status(200);
    return c.json({
      success: true,
      data: { blogId: updatedBlog.id },
      message: "Blog Updated Successfully",
    });
  } catch (e) {
    console.log(e);
    c.status(500);
    return c.json({
      success: false,
      data: null,
      message: "Internal Server Issue",
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});

blogRouter.put("submitDraft/:blogId", async (c) => {
  let prisma;
  try {
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    const blogId = Number(c.req.param("blogId"));
    const authorId = Number(c.get("authorId"));
    const existingDraft = await prisma.blog.findUnique({
      where: {
        id: blogId,
        authorId: authorId,
        published: false,
      },
    });
    if (!existingDraft) {
      c.status(404);
      return c.json({
        success: false,
        data: null,
        message: "Blog not found or already published",
      });
    }
    const publishedBlog = await prisma.blog.update({
      where: {
        id: blogId,
        published: false,
      },
      data: {
        published: true,
        createdAt: new Date(),
      },
    });
    c.status(200);
    return c.json({
      success: true,
      data: { blogId: publishedBlog.id },
      message: "Draft published successfully",
    });
  } catch (e) {
    c.status(500);
    return c.json({
      success: false,
      data: null,
      message: "Internal Server Issue",
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});

blogRouter.get("/drafts", async (c) => {
  let prisma;
  try {
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    const drafts = await prisma.blog.findMany({
      where: {
        published: false,
      },
      select: {
        id: true,
        title: true,
        content: true,
        tag: true,
        author: {
          select: {
            username: true,
          },
        },
      },
    });
    c.status(200);
    return c.json({
      success: true,
      data: { drafts },
      message: drafts.length > 0 ? "Your Drafts" : "No Drafts",
    });
  } catch (e) {
    c.status(500);
    return c.json({
      success: false,
      data: null,
      message: "Internal Server Issue",
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});

blogRouter.get("/search/:query", async (c) => {
  let prisma;
  try {
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    const query = c.req.param("query");
    const filteredBlogs = await prisma.blog.findMany({
      where: {
        published: true,
        OR: [
          {
            title: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            content: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            tag: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        content: true,
        tag: true,
        author: {
          select: {
            username: true,
          },
        },
      },
    });
    c.status(200);
    return c.json({
      success: true,
      data: { filteredBlogs },
      message: "Filtered Blogs Successfully",
    });
  } catch (e) {
    console.log(e);
    c.status(500);
    return c.json({
      success: false,
      data: null,
      message: "Internal Server Issue",
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});

blogRouter.get("/bulk/:page", async (c) => {
  let prisma;
  try {
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    const page = Number(c.req.param("page"));
    const limit = 10;

    if (page < 1) {
      c.status(400);
      return c.json({
        success: false,
        data: null,
        message: "Starting Page Number is 1",
      });
    }
    const totalBlogs = await prisma.blog.count({ where: { published: true } });
    const totalPages = Math.ceil(totalBlogs / limit);
    if (page > totalPages || totalPages === 0) {
      c.status(400);
      return c.json({
        success: false,
        data: null,
        message:
          totalPages === 0
            ? "No Blogs Found"
            : `Final Page Number is ${totalPages}`,
      });
    }
    const skip = (page - 1) * limit;
    const bulkBlogs = await prisma.blog.findMany({
      skip: skip,
      take: limit,
      where: { published: true },
      select: {
        id: true,
        title: true,
        content: true,
        tag: true,
        createdAt: true,
        author: {
          select: {
            username: true,
          },
        },
        comments: {
          select: {
            id: true,
            comment: true,
            commenter: {
              select: {
                username: true,
              },
            },
            likes: {
              select: {
                id: true,
                user: {
                  select: {
                    username: true,
                  },
                },
              },
            },
          },
        },
        likes: {
          select: {
            id: true,
            user: {
              select: {
                username: true,
              },
            },
          },
        },
      },
      orderBy: { id: "desc" },
    });
    const blogs = bulkBlogs.map((blog) => ({
      ...blog,
      createdAt: `${blog.createdAt.toDateString()} ${blog.createdAt
        .getHours()
        .toString()
        .padStart(2, "0")}:${blog.createdAt
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
    }));
    c.status(200);
    return c.json({
      success: true,
      data: {
        blogs,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page - 1 >= 1,
      },
      message: "Multiple Blogs",
    });
  } catch (e) {
    console.log(e);
    c.status(500);
    return c.json({
      success: false,
      data: null,
      message: "Internal Server Issue",
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});

blogRouter.get("/:blogId", async (c) => {
  let prisma;
  try {
    const blogId = Number(c.req.param("blogId"));
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    const existingBlog = await prisma.blog.findFirst({
      where: {
        id: blogId,
        published: true,
      },
      select: {
        id: true,
        title: true,
        content: true,
        tag: true,
        createdAt: true,
        author: {
          select: {
            username: true,
          },
        },
        comments: {
          select: {
            id: true,
            comment: true,
          },
        },
      },
    });
    if (!existingBlog) {
      c.status(404);
      return c.json({ success: false, data: null, message: "Blog Not Found" });
    }
    const blog = {
      ...existingBlog,
      createdAt: `${existingBlog.createdAt.toDateString()} ${existingBlog.createdAt
        .getHours()
        .toString()
        .padStart(2, "0")}:${existingBlog.createdAt
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
    };
    c.status(200);
    return c.json({
      success: true,
      data: { blog },
      message: "Found the Blog",
    });
  } catch (e) {
    console.log(e);
    c.status(500);
    return c.json({
      success: false,
      data: null,
      message: "Internal Server Issue",
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});

blogRouter.delete("/delete/:blogId", async (c) => {
  let prisma;
  try {
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    const blogId = Number(c.req.param("blogId"));
    const existingBlog = await prisma.blog.findUnique({
      where: {
        id: blogId,
      },
    });
    if (!existingBlog) {
      c.status(404);
      return c.json({
        success: false,
        data: null,
        message: "Blog not found",
      });
    }
    const deletedBlog = await prisma.blog.delete({
      where: {
        id: blogId,
      },
    });
    c.status(200);
    return c.json({
      success: true,
      data: { blogId: deletedBlog.id },
      message: "Blog deleted successfully",
    });
  } catch (e) {
    console.log(e);
    c.status(500);
    return c.json({
      success: false,
      data: null,
      message: "Internal Server Issue",
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});
