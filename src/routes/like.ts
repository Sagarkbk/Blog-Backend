import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { Hono } from "hono";

export const likeRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
  Variables: {
    authorId: string;
  };
}>();

likeRouter.post("/blogLikes/:blogId", async (c) => {
  let prisma;
  try {
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    const authorId = Number(c.get("authorId"));
    const blogId = Number(c.req.param("blogId"));
    const existingBlog = await prisma.blog.findUnique({
      where: {
        id: blogId,
        authorId: authorId,
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

    const result = await prisma.$transaction(async (tx) => {
      const alreadyLiked = await tx.blogLike.findUnique({
        where: {
          likedById_blogId: {
            likedById: authorId,
            blogId: blogId,
          },
        },
      });

      if (alreadyLiked) {
        await tx.blogLike.delete({
          where: {
            likedById_blogId: {
              likedById: authorId,
              blogId: blogId,
            },
          },
        });
        return { action: "unlike" };
      } else {
        await tx.blogLike.create({
          data: {
            likedById: authorId,
            blogId: blogId,
          },
        });
        return { action: "like" };
      }
    });

    c.status(200);
    return c.json({
      success: true,
      data:
        result.action === "like"
          ? { likedBlog: blogId }
          : { likeRemovedBlog: blogId },
      message:
        result.action === "like" ? "You've Liked this Blog" : "Like Removed",
    });
  } catch (e) {
    c.status(500);
    return c.json({
      success: false,
      message: "Internal Server Issue",
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});

likeRouter.post("/commentLikes/:blogId/:commentId", async (c) => {
  let prisma;
  try {
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    const authorId = Number(c.get("authorId"));
    const blogId = Number(c.req.param("blogId"));
    const commentId = Number(c.req.param("commentId"));
    const existingBlog = await prisma.blog.findUnique({
      where: {
        id: blogId,
        authorId: authorId,
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
    const existingComment = await prisma.comment.findUnique({
      where: {
        id: commentId,
        blogId: blogId,
        commentedById: authorId,
      },
    });
    if (!existingComment) {
      c.status(404);
      return c.json({
        success: false,
        data: null,
        message: "Comment Not Found",
      });
    }
    const result = await prisma.$transaction(async (tx) => {
      const alreadyLiked = await tx.commentLike.findUnique({
        where: {
          likedById_commentId: {
            likedById: authorId,
            commentId: commentId,
          },
        },
      });

      if (alreadyLiked) {
        await tx.commentLike.delete({
          where: {
            likedById_commentId: {
              likedById: authorId,
              commentId: commentId,
            },
          },
        });
        return { action: "unlike" };
      } else {
        await tx.commentLike.create({
          data: {
            likedById: authorId,
            commentId: commentId,
          },
        });
        return { action: "like" };
      }
    });
    c.status(200);
    return c.json({
      success: true,
      data:
        result.action === "like"
          ? { likedComment: commentId }
          : { removedLikeOnComment: commentId },
      message:
        result.action === "like" ? "You've Liked this Comment" : "Like Removed",
    });
  } catch (e) {
    console.log(e);
    c.status(500);
    return c.json({
      success: false,
      message: "Internal Server Issue",
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});

likeRouter.get("/blogLikes/:blogId", async (c) => {
  let prisma;
  try {
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    const authorId = Number(c.get("authorId"));
    const blogId = Number(c.req.param("blogId"));

    const existingBlog = await prisma.blog.findUnique({
      where: {
        id: blogId,
        authorId: authorId,
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
    const likes = await prisma.blogLike.findMany({
      where: {
        blogId: blogId,
      },
      select: {
        createdAt: true,
        user: {
          select: {
            username: true,
          },
        },
      },
    });
    const formattedLikes = likes.map((like) => ({
      ...like,
      createdAt: `${like.createdAt.toDateString()} ${like.createdAt
        .getHours()
        .toString()
        .padStart(2, "0")}:${like.createdAt
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
    }));
    c.status(200);
    return c.json({
      success: true,
      data: {
        likes: formattedLikes,
        totalLikes: likes.length,
      },
    });
  } catch (e) {
    c.status(500);
    return c.json({
      success: false,
      message: "Internal Server Issue",
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});

likeRouter.get("/commentLikes/:blogId/:commentId", async (c) => {
  let prisma;
  try {
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
    const authorId = Number(c.get("authorId"));
    const blogId = Number(c.req.param("blogId"));
    const commentId = Number(c.req.param("commentId"));

    const existingBlog = await prisma.blog.findUnique({
      where: {
        id: blogId,
        authorId: authorId,
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
    const existingComment = await prisma.comment.findUnique({
      where: {
        id: commentId,
        blogId: blogId,
        commentedById: authorId,
      },
    });
    if (!existingComment) {
      c.status(404);
      return c.json({
        success: false,
        data: null,
        message: "Comment Not Found",
      });
    }
    const likes = await prisma.commentLike.findMany({
      where: {
        commentId: commentId,
      },
      select: {
        createdAt: true,
        user: {
          select: {
            username: true,
          },
        },
      },
    });
    const formattedLikes = likes.map((like) => ({
      ...like,
      createdAt: `${like.createdAt.toDateString()} ${like.createdAt
        .getHours()
        .toString()
        .padStart(2, "0")}:${like.createdAt
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
    }));
    c.status(200);
    return c.json({
      success: true,
      data: {
        likes: formattedLikes,
        totalLikes: likes.length,
      },
    });
  } catch (e) {
    c.status(500);
    return c.json({
      success: false,
      message: "Internal Server Issue",
    });
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});
