import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageContainer } from "@/components/base/PageContainer";
import { PageHeader } from "@/components/base/PageHeader";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/features/auth/usePermissions";
import { useToast } from "@/components/ui/toast-context";
import type { CreateProjectRequest, Project } from "@/types/api";
import { ProjectForm } from "./ProjectForm";
import { useCreateProject } from "./projectQueries";

export function ProjectCreatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const create = useCreateProject();
  const [created, setCreated] = useState<Project | null>(null);
  const [completed, setCompleted] = useState(false);
  const back = params.get("return_to");
  const destination = hasPermission("projects:read")
    ? back && /^\/app\/projects(?:\?|$)/.test(back)
      ? back
      : "/app/projects"
    : "/app/dashboard";
  return (
    <PageContainer>
      <PageHeader
        title={completed ? "Projeto criado" : "Novo projeto"}
        description={
          completed
            ? "O rascunho foi salvo. Continue a organização do projeto quando desejar."
            : "Organize o cadastro, o planejamento e os próximos passos da operação."
        }
      />
      {completed && created ? (
        <section className="premium-panel grid gap-5 p-6 sm:p-8" role="status">
          <CheckCircle2 className="text-primary" size={32} aria-hidden="true" />
          <div>
            <h2 className="text-xl font-bold">{created.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {created.code ? `${created.code} · ` : ""}Rascunho criado com
              sucesso. As unidades e a equipe podem ser vinculadas no resumo do
              projeto.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {hasPermission("projects:read") ? (
              <Link
                className="font-semibold text-primary underline"
                to={`/app/projects/${created.id}/summary`}
              >
                Abrir projeto e completar estrutura
              </Link>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(destination)}
            >
              Voltar
            </Button>
            <Button
              type="button"
              onClick={() => {
                setCompleted(false);
                setCreated(null);
              }}
            >
              Cadastrar outro projeto
            </Button>
          </div>
        </section>
      ) : (
        <ProjectForm
          mode="create"
          busy={create.isPending}
          onCancel={() => navigate(destination)}
          onComplete={() => {
            setCompleted(true);
            toast({
              title: "Projeto criado",
              description: "O projeto foi salvo como rascunho.",
              tone: "success",
            });
          }}
          onSubmit={async (payload) => {
            const result = await create.mutateAsync(
              payload as CreateProjectRequest,
            );
            setCreated(result);
          }}
        />
      )}
    </PageContainer>
  );
}
