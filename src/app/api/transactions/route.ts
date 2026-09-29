
import { NextResponse } from "next/server";
import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { getCurrentUser } from "../../../lib/current-user";

type Input = {
  id?: unknown;
  title?: unknown;
  amount?: unknown;
  type?: unknown;
  categoryId?: unknown;
  date?: unknown;
  note?: unknown;
};

function validate(body: Input): string | null {
  if (
    typeof body.title !== "string" ||
    body.title.trim().length < 2 ||
    body.title.trim().length > 100
  ) {
    return "Invalid transaction title";
  }

  if (
    typeof body.amount !== "string" ||
    !/^\d{1,10}(\.\d{1,2})?$/.test(body.amount) ||
    Number(body.amount) <= 0
  ) {
    return "Enter a valid positive amount";
  }

  if (
    body.type !== "INCOME" &&
    body.type !== "EXPENSE"
  ) {
    return "Invalid transaction type";
  }

  if (
    typeof body.categoryId !== "string" ||
    !body.categoryId
  ) {
    return "Select a category";
  }

  if (
    typeof body.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.date)
  ) {
    return "Invalid date";
  }

  const date = new Date(`${body.date}T12:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== body.date
  ) {
    return "Invalid calendar date";
  }

  if (
    body.note !== undefined &&
    (
      typeof body.note !== "string" ||
      body.note.length > 500
    )
  ) {
    return "Invalid note";
  }

  return null;
}

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");

  return (
    !origin ||
    origin === new URL(request.url).origin
  );
}

// GET
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    include: {
      category: {
        select: { name: true },
      },
    },
    orderBy: [
      { date: "desc" },
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json(
    transactions.map((t) => ({
      ...t,
      amount: t.amount.toString(),
      date: t.date.toISOString().slice(0, 10),
    }))
  );
}

// POST
export async function POST(request: Request) {
  if (!validOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid origin" },
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
    const body: Input = await request.json();
    const error = validate(body);

    if (error) {
      return NextResponse.json(
        { error },
        { status: 400 }
      );
    }

    const category = await prisma.category.findFirst({
      where: {
        id: body.categoryId as string,
        userId: user.id,
        type: body.type as TransactionType,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.create({
      data: {
        title: (body.title as string).trim(),
        amount: new Prisma.Decimal(body.amount as string),
        type: body.type as TransactionType,
        categoryId: category.id,
        userId: user.id,
        date: new Date(`${body.date}T12:00:00.000Z`),
        note: (body.note as string | undefined)?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        ...transaction,
        amount: transaction.amount.toString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create transaction:", error);

    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}

// PATCH
export async function PATCH(request: Request) {
  if (!validOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid origin" },
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
    const body: Input = await request.json();
    const error = validate(body);

    if (typeof body.id !== "string" || error) {
      return NextResponse.json(
        { error: error || "Invalid ID" },
        { status: 400 }
      );
    }

    const category = await prisma.category.findFirst({
      where: {
        id: body.categoryId as string,
        userId: user.id,
        type: body.type as TransactionType,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    const result = await prisma.transaction.updateMany({
      where: {
        id: body.id,
        userId: user.id,
      },
      data: {
        title: (body.title as string).trim(),
        amount: new Prisma.Decimal(body.amount as string),
        type: body.type as TransactionType,
        categoryId: category.id,
        date: new Date(`${body.date}T12:00:00.000Z`),
        note: (body.note as string | undefined)?.trim() || null,
      },
    });

    if (!result.count) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Transaction updated",
    });
  } catch (error) {
    console.error("Update transaction:", error);

    return NextResponse.json(
      { error: "Update failed" },
      { status: 500 }
    );
  }
}

// DELETE
export async function DELETE(request: Request) {
  if (!validOrigin(request)) {
    return NextResponse.json(
      { error: "Invalid origin" },
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

    if (typeof body.id !== "string") {
      return NextResponse.json(
        { error: "Invalid ID" },
        { status: 400 }
      );
    }

    const result = await prisma.transaction.deleteMany({
      where: {
        id: body.id,
        userId: user.id,
      },
    });

    if (!result.count) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Transaction deleted",
    });
  } catch (error) {
    console.error("Delete transaction:", error);

    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    );
  }
}
