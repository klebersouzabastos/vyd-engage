import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, CheckCircle, Download, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  detectLocalStorageData,
  hasDataToMigrate,
  migrateDataToAPI,
  backupLocalStorageData,
  clearMigratedData,
} from '../utils/migration';
import { toast } from 'sonner';

interface MigrationModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function MigrationModal({ open, onClose, onComplete }: MigrationModalProps) {
  const [step, setStep] = useState<'detect' | 'backup' | 'migrate' | 'complete'>('detect');
  const [dataToMigrate, setDataToMigrate] = useState<any>(null);
  const [backupCreated, setBackupCreated] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({
    current: 0,
    total: 0,
    type: '',
  });
  const [migrationErrors, setMigrationErrors] = useState<string[]>([]);
  const [migrating, setMigrating] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  useEffect(() => {
    if (open) {
      const data = detectLocalStorageData();
      setDataToMigrate(data);
      setStep('detect');
      setBackupCreated(false);
      setMigrationProgress({ current: 0, total: 0, type: '' });
      setMigrationErrors([]);
    }
  }, [open]);

  const handleBackup = () => {
    try {
      backupLocalStorageData();
      setBackupCreated(true);
      toast.success('Backup criado com sucesso!');
      setStep('migrate');
    } catch (error: any) {
      toast.error(`Erro ao criar backup: ${error.message}`);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrationErrors([]);

    try {
      const result = await migrateDataToAPI((progress) => {
        setMigrationProgress(progress);
      });

      if (result.success) {
        setStep('complete');
        toast.success('Migração concluída com sucesso!');
      } else {
        setMigrationErrors(result.errors);
        toast.warning(`Migração concluída com ${result.errors.length} erros`);
      }
    } catch (error: any) {
      toast.error(`Erro na migração: ${error.message}`);
      setMigrationErrors([error.message]);
    } finally {
      setMigrating(false);
    }
  };

  const handleClearLocalStorage = () => {
    clearMigratedData();
    toast.success('Dados do localStorage limpos');
    setClearDialogOpen(false);
    onComplete();
    onClose();
  };

  const getDataSummary = () => {
    if (!dataToMigrate) return null;

    return {
      leads: dataToMigrate.leads?.length || 0,
      tasks: dataToMigrate.tasks?.length || 0,
      tags: dataToMigrate.tags?.length || 0,
      automations: dataToMigrate.automations?.length || 0,
      total:
        (dataToMigrate.leads?.length || 0) +
        (dataToMigrate.tasks?.length || 0) +
        (dataToMigrate.tags?.length || 0) +
        (dataToMigrate.automations?.length || 0),
    };
  };

  const summary = getDataSummary();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Migração de Dados</DialogTitle>
          <DialogDescription>
            Migre seus dados do localStorage para o banco de dados do servidor
          </DialogDescription>
        </DialogHeader>

        {step === 'detect' && (
          <div className="space-y-4">
            {summary && summary.total > 0 ? (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Encontramos dados no localStorage que podem ser migrados:
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  {summary.leads > 0 && (
                    <div className="flex justify-between">
                      <span>Leads:</span>
                      <span className="font-medium">{summary.leads}</span>
                    </div>
                  )}
                  {summary.tasks > 0 && (
                    <div className="flex justify-between">
                      <span>Tarefas:</span>
                      <span className="font-medium">{summary.tasks}</span>
                    </div>
                  )}
                  {summary.tags > 0 && (
                    <div className="flex justify-between">
                      <span>Tags:</span>
                      <span className="font-medium">{summary.tags}</span>
                    </div>
                  )}
                  {summary.automations > 0 && (
                    <div className="flex justify-between">
                      <span>Automações:</span>
                      <span className="font-medium">{summary.automations}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleBackup} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Criar Backup Primeiro
                  </Button>
                  <Button onClick={() => setStep('migrate')} variant="outline" className="flex-1">
                    Pular Backup
                  </Button>
                </div>
              </>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum dado encontrado no localStorage para migrar.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === 'backup' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                É recomendado criar um backup antes de migrar os dados.
              </AlertDescription>
            </Alert>

            {backupCreated ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>Backup criado com sucesso!</AlertDescription>
              </Alert>
            ) : (
              <Button onClick={handleBackup} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Criar Backup
              </Button>
            )}

            {backupCreated && (
              <Button onClick={() => setStep('migrate')} className="w-full">
                Continuar para Migração
              </Button>
            )}
          </div>
        )}

        {step === 'migrate' && (
          <div className="space-y-4">
            {migrating ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>
                      Migrando {migrationProgress.type}... ({migrationProgress.current}/
                      {migrationProgress.total})
                    </span>
                    <span>
                      {migrationProgress.total > 0
                        ? Math.round((migrationProgress.current / migrationProgress.total) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      migrationProgress.total > 0
                        ? (migrationProgress.current / migrationProgress.total) * 100
                        : 0
                    }
                  />
                </div>

                {migrationErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium">Erros encontrados:</p>
                        <ul className="list-disc list-inside text-sm">
                          {migrationErrors.slice(0, 5).map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                          {migrationErrors.length > 5 && (
                            <li>... e mais {migrationErrors.length - 5} erros</li>
                          )}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Pronto para migrar {summary?.total || 0} itens para o servidor.
                  </AlertDescription>
                </Alert>

                <Button onClick={handleMigrate} className="w-full" disabled={migrating}>
                  {migrating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Migrando...
                    </>
                  ) : (
                    'Iniciar Migração'
                  )}
                </Button>
              </>
            )}
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Migração concluída! Seus dados foram transferidos para o servidor.
              </AlertDescription>
            </Alert>

            {migrationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Alguns itens não puderam ser migrados. Verifique os erros acima.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button onClick={() => setClearDialogOpen(true)} variant="outline" className="flex-1">
                Limpar localStorage
              </Button>
              <Button
                onClick={() => {
                  onComplete();
                  onClose();
                }}
                className="flex-1"
              >
                Concluir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Clear localStorage Confirmation */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar localStorage</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja limpar os dados do localStorage? O backup já foi criado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearLocalStorage}
              className="bg-red-600 hover:bg-red-700"
            >
              Limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
