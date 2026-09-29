
import { NextResponse } from "next/server";
import { Prisma, TransactionType } from "@prisma/client";

import { prisma } from "../../../lib/prisma";
import { getCurrentUser } from "../../../lib/current-user";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const categories = await prisma.category.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      name: "asc",
    },
  });

  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");

  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    if (
      typeof body.name !== "string" ||
      body.name.trim().length < 2 ||
      body.name.trim().length > 50 ||
      !["INCOME", "EXPENSE"].includes(body.type)
    ) {
      return NextResponse.json(
        { error: "Invalid category data" },
        { status: 400 }
      );
    }

    const category = await prisma.category.create({
      data: {
        name: body.name.trim(),
        type: body.type as TransactionType,
        userId: user.id,
      },
    });

    return NextResponse.json(category, {
      status: 201,
    });

  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Category already exists" },
        { status: 409 }
      );
    }

    console.error("Category error:", error);

    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
