import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const assignments = await prisma.employeeLineManagerAssignment.findMany({
    where: { employee_id: 3363, is_active: true },
  });
  console.log(assignments);
}
main().catch(console.error).finally(() => prisma.$disconnect());
