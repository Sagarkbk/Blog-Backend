import { Hono } from "hono";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { verify } from "hono/jwt";

export const commentRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
  Variables: {
    authorId: string;
  };
}>();

commentRouter.post("/postComment/:blogId", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());
  const body = await c.req.json();
  const authorId = Number(c.get("authorId"));
  const blogId = Number(c.req.param("blogId"));

  try {
    const existingBlog = await prisma.blog.findFirst({
      where: {
        published: true,
        // AND: [{ id: blogId }, { authorId: authorId }],
        id: blogId,
        authorId: authorId,
      },
    });
    if (!existingBlog) {
      c.status(404);
      return c.json({
        success: false,
        data: null,
        message: "Invalid Blog ID",
      });
    }
    await prisma.comment.create({
      data: {
        comment: body.comment,
        commentedById: authorId,
        blogId: blogId,
      },
    });
    c.status(201);
    return c.json({
      success: true,
      data: null,
      message: "Comment added successfully",
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
    await prisma.$disconnect();
  }
});

commentRouter.get("/getComments/:blogId", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());
  const blogId = Number(c.req.param("blogId"));

  try {
    const existingBlog = await prisma.blog.findFirst({
      where: {
        id: blogId,
      },
    });
    if (!existingBlog) {
      c.status(404);
      return c.json({
        success: false,
        data: null,
        message: "Invalid Blog ID",
      });
    }
    const comments = await prisma.comment.findMany({
      where: {
        blogId: blogId,
      },
      select: {
        id: true,
        comment: true,
      },
    });
    c.status(200);
    // if (comments.length === 0) {
    //   return c.json({
    //     success: true,
    //     data: null,
    //     message: "No Comments",
    //   });
    // }
    return c.json({
      success: true,
      data: { comments },
      message: "All Comments",
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
    await prisma.$disconnect();
  }
});

commentRouter.delete("deleteComment/:blogId/:commentId", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());
  const authorId = Number(c.get("authorId"));
  const blogId = Number(c.req.param("blogId"));
  const commentId = Number(c.req.param("commentId"));

  try {
    const existingBlog = await prisma.blog.findFirst({
      where: {
        id: blogId,
      },
    });
    if (!existingBlog) {
      c.status(404);
      return c.json({
        success: false,
        data: null,
        message: "Invalid Blog ID",
      });
    }
    const existingComment = await prisma.comment.findUnique({
      where: {
        id: commentId,
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
    await prisma.comment.delete({
      where: {
        id: commentId,
      },
    });
    c.status(200);
    return c.json({
      success: true,
      data: null,
      message: "Comment Deleted Successfully",
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
    await prisma.$disconnect();
  }
});
