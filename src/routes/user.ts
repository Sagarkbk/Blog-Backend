import { Hono } from "hono";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { sign } from "hono/jwt";
import { followRouter } from "./follow";
import { signinInput, signupInput } from "@sagarkbk/blog-common";

export const userRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
}>();

userRouter.route("/follow", followRouter);

userRouter.post("/signup", async (c) => {
  let prisma;
  try {
    const body = await c.req.json();
    const inputValidation = signupInput.safeParse(body);
    if (!inputValidation.success) {
      c.status(400);
      return c.json({
        success: false,
        data: null,
        message: inputValidation.error.flatten().fieldErrors.username
          ? "Username : " + inputValidation.error.flatten().fieldErrors.username
          : inputValidation.error.flatten().fieldErrors.email
          ? "Email : " + inputValidation.error.flatten().fieldErrors.email
          : inputValidation.error.flatten().fieldErrors.password
          ? "Password : " + inputValidation.error.flatten().fieldErrors.password
          : "Incorrect Inputs",
      });
    }
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
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
        message: "Email Already Taken",
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
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});

userRouter.post("/signin", async (c) => {
  let prisma;
  try {
    const body = await c.req.json();
    const inputValidation = signinInput.safeParse(body);
    if (!inputValidation.success) {
      c.status(400);
      return c.json({
        success: false,
        data: null,
        message: inputValidation.error.flatten().fieldErrors.email
          ? "Email : " + inputValidation.error.flatten().fieldErrors.email
          : inputValidation.error.flatten().fieldErrors.password
          ? "Password : " + inputValidation.error.flatten().fieldErrors.password
          : "Incorrect Inputs",
      });
    }
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
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
  } finally {
    if (prisma) await prisma.$disconnect();
  }
});

userRouter.get("/users", async (c) => {
  let prisma;
  try {
    prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
    }).$extends(withAccelerate());
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
    if (prisma) await prisma.$disconnect();
  }
});
