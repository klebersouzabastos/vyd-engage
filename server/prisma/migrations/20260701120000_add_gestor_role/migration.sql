-- AlterEnum
-- Adiciona o papel GESTOR (estrategista comercial) entre ADMIN e USER.
-- Aditivo e não-destrutivo; nenhum usuário existente é alterado.
ALTER TYPE "UserRole" ADD VALUE 'GESTOR' BEFORE 'USER';
