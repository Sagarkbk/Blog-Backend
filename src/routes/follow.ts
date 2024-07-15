import { Hono } from "hono";
import { withAccelerate } from "@prisma/extension-accelerate";
import { verify } from "hono/jwt";
import { PrismaClient, Prisma } from "@prisma/client/edge";

export const followRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
  Variables: {
    authorId: string;
  };
}>();

followRouter.use("/*", async (c, next) => {
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

followRouter.post("/:followingId", async (c) => {
  const authorId = Number(c.get("authorId"));
  const followingId = Number(c.req.param("followingId"));
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    if (authorId === followingId) {
      c.status(400);
      return c.json({
        success: false,
        data: null,
        message: "You cannot follow yourself",
      });
    }

    const [author, following] = await Promise.all([
      prisma.user.findUnique({ where: { id: authorId } }),
      prisma.user.findUnique({ where: { id: followingId } }),
    ]);

    if (!author || !following) {
      c.status(404);
      return c.json({
        success: false,
        data: null,
        message: "User not found",
      });
    }

    const alreadyFollowing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: authorId,
          followingId: followingId,
        },
      },
    });

    if (alreadyFollowing) {
      await prisma.follow.delete({
        where: {
          followerId_followingId: {
            followerId: authorId,
            followingId: followingId,
          },
        },
      });
      c.status(201);
      return c.json({
        success: true,
        data: null,
        message: "Unfollowed",
      });
    }

    await prisma.follow.create({
      data: {
        followerId: authorId,
        followingId: followingId,
      },
    });
    c.status(201);
    return c.json({
      success: true,
      data: null,
      message: "You're now Following this author",
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code == "P2002") {
        c.status(400);
        return c.json({
          success: false,
          data: null,
          message: "Already following this user",
        });
      }
    }
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

followRouter.get("/followers/:page", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());
  const authorId = Number(c.get("authorId"));
  const page = Number(c.req.param("page"));
  const limit = 5;

  if (page < 1) {
    c.status(400);
    return c.json({
      success: false,
      data: null,
      message: "Starting Page is 1",
    });
  }

  try {
    const totalFollowers = await prisma.follow.count({
      where: {
        followingId: authorId,
      },
    });
    const totalPages = Math.ceil(totalFollowers / limit);
    if (totalPages === 0 || page > totalPages) {
      c.status(400);
      return c.json({
        success: false,
        data: null,
        message:
          totalPages === 0
            ? "No followers found"
            : `Final Page is ${totalPages}`,
      });
    }
    const skip = (page - 1) * limit;
    const followers = await prisma.follow.findMany({
      skip: skip,
      take: limit,
      where: {
        followingId: authorId,
      },
      select: {
        follower: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    const flattenedFollowers = followers.map((f) => f.follower);
    c.status(200);
    return c.json({
      success: true,
      data: {
        followers: flattenedFollowers,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page - 1 >= 1,
      },
      message: "Your Followers",
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

followRouter.get("/following/:page", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());
  const authorId = Number(c.get("authorId"));
  const page = Number(c.req.param("page"));
  const limit = 5;

  if (page < 1) {
    c.status(400);
    return c.json({
      success: false,
      data: null,
      message: "Starting Page is 1",
    });
  }

  try {
    const totalFollowing = await prisma.follow.count({
      where: {
        followerId: authorId,
      },
    });
    const totalPages = Math.ceil(totalFollowing / limit);
    if (page > totalPages || totalPages === 0) {
      c.status(400);
      return c.json({
        success: false,
        data: null,
        message:
          totalPages === 0
            ? "You are not following anyone"
            : `Final Page is ${totalPages}`,
      });
    }
    const skip = (page - 1) * limit;
    const following = await prisma.follow.findMany({
      skip: skip,
      take: limit,
      where: {
        followerId: authorId,
      },
      select: {
        following: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    const flattenedFollowing = following.map((f) => f.following);
    c.status(200);
    return c.json({
      success: true,
      data: {
        following: flattenedFollowing,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page - 1 >= 1,
      },
      message: "You're Following",
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

followRouter.get("/all", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());
  const data = await prisma.follow.findMany();
  return c.json(data);
});
