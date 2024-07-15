import { Hono } from "hono";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { sign } from "hono/jwt";
import { followRouter } from "./follow";

export const userRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
}>();

userRouter.route("/follow", followRouter);

userRouter.post("/signup", async (c) => {
  const body = await c.req.json();
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    if (!(body.username && body.email && body.password)) {
      c.status(400);
      return c.json({
        success: false,
        data: null,
        message: "Invalid Data",
      });
    }
    const existingUser = await prisma.user.findFirst({
      where: {
        email: body.email,
      },
    });
    if (existingUser) {
      c.status(411);
      return c.json({
        success: false,
        data: null,
        message: "Email already in use",
      });
    }
    const newUser = await prisma.user.create({
      data: {
        username: body.username,
        email: body.email,
        password: body.password,
      },
    });
    const jwt_token = await sign(
      {
        id: newUser.id,
      },
      c.env.JWT_SECRET
    );
    c.status(201);
    return c.json({
      success: true,
      data: { jwt_token },
      message: "Account Created Successfully",
    });
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

userRouter.post("/signin", async (c) => {
  const body = await c.req.json();
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: body.email,
        password: body.password,
      },
    });
    if (!existingUser) {
      c.status(401);
      return c.json({
        success: false,
        data: null,
        message: "Invalid Credentials",
      });
    }
    const jwt_token = await sign(
      {
        id: existingUser.id,
      },
      c.env.JWT_SECRET
    );
    c.status(200);
    return c.json({
      success: true,
      data: { jwt_token },
      message: "Successfull Login",
    });
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

userRouter.get("/users", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    const users = await prisma.user.findMany();
    c.status(200);
    return c.json({
      success: true,
      data: { users },
      message: "All Users",
    });
  } catch (e) {
    console.log(e);
    c.status(500);
    return c.json({
      success: false,
      message: "Internal Server Issue",
    });
  } finally {
    await prisma.$disconnect();
  }
});
