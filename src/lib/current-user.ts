
import "server-only";

import { prisma } from "../lib/prisma";
import { getSessionUserId } from "../lib/auth";

export async function getCurrentUser() {
  const userId = await getSessionUserId();

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}
