import { prisma } from "../../db/prisma";
import { errors } from "../../utils/http";

export async function listAreas() {
  return prisma.deliveryArea.findMany({ orderBy: [{ sequence: "asc" }, { name: "asc" }] });
}

export async function createArea(name: string) {
  const existing = await prisma.deliveryArea.findUnique({ where: { name } });
  if (existing) throw errors.conflict("Area already exists");
  const maxSeq = await prisma.deliveryArea.aggregate({ _max: { sequence: true } });
  return prisma.deliveryArea.create({ data: { name, sequence: (maxSeq._max.sequence ?? 0) + 1 } });
}

export async function renameArea(id: number, name: string) {
  const existing = await prisma.deliveryArea.findUnique({ where: { areaId: id } });
  if (!existing) throw errors.notFound("Area not found");
  const clash = await prisma.deliveryArea.findUnique({ where: { name } });
  if (clash && clash.areaId !== id) throw errors.conflict("Area already exists");
  return prisma.deliveryArea.update({ where: { areaId: id }, data: { name } });
}

export async function deleteArea(id: number) {
  const existing = await prisma.deliveryArea.findUnique({ where: { areaId: id } });
  if (!existing) throw errors.notFound("Area not found");
  await prisma.deliveryArea.delete({ where: { areaId: id } });
}

export async function reorderAreas(orderedIds: number[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.deliveryArea.update({ where: { areaId: id }, data: { sequence: index + 1 } })),
  );
  return listAreas();
}
