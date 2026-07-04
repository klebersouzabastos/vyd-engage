import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Star } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { apiClient } from '../../services/api/client';
import type { QualificationConfig } from '../../types/sales';

/**
 * Configurações de Negócios → Qualificação (upgrade-rd-parity req 1 e 3):
 * nomes editáveis dos 5 níveis, pontuação máxima opcional por nível e toggle
 * de qualificação automática via questionários (exige as 5 pontuações).
 * 100% tokens semânticos (STRICT_SCOPE do check:colors).
 */

interface LevelDraft {
  level: number;
  name: string;
  /** Texto do input — vazio = maxScore null. */
  maxScoreText: string;
}

export function QualificationTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState<LevelDraft[]>([]);
  const [autoQualify, setAutoQualify] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getQualificationConfig()
      .then((res) => {
        if (cancelled) return;
        const cfg = res.data;
        setLevels(
          cfg.levels.map((l) => ({
            level: l.level,
            name: l.name,
            maxScoreText: l.maxScore === null ? '' : String(l.maxScore),
          }))
        );
        setAutoQualify(cfg.autoQualifyEnabled);
      })
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar qualificação')
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const anyScoreEmpty = levels.some((l) => l.maxScoreText.trim() === '');

  const setLevel = (level: number, patch: Partial<LevelDraft>) => {
    setLevels((prev) => prev.map((l) => (l.level === level ? { ...l, ...patch } : l)));
  };

  const validate = (): QualificationConfig | null => {
    const next: Record<number, string> = {};
    let prevScore: number | null = null;

    const parsed = levels.map((l) => {
      const name = l.name.trim();
      if (!name) next[l.level] = 'Informe o nome do nível';

      let maxScore: number | null = null;
      const text = l.maxScoreText.trim();
      if (text !== '') {
        const n = Number(text);
        if (!Number.isInteger(n) || n < 0) {
          next[l.level] = 'Pontuação deve ser um número inteiro maior ou igual a zero';
        } else {
          maxScore = n;
          if (prevScore !== null && n <= prevScore) {
            next[l.level] = 'Pontuação deve ser maior que a do nível anterior';
          }
          prevScore = n;
        }
      }
      return { level: l.level, name, maxScore };
    });

    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    // Auto-qualify exige as 5 pontuações definidas — força desligado se faltar.
    const autoQualifyEnabled = autoQualify && parsed.every((l) => l.maxScore !== null);
    return { levels: parsed, autoQualifyEnabled };
  };

  const save = async () => {
    const cfg = validate();
    if (!cfg) return;
    try {
      setSaving(true);
      const res = await apiClient.updateQualificationConfig(cfg);
      const saved = res.data;
      setLevels(
        saved.levels.map((l) => ({
          level: l.level,
          name: l.name,
          maxScoreText: l.maxScore === null ? '' : String(l.maxScore),
        }))
      );
      setAutoQualify(saved.autoQualifyEnabled);
      toast.success('Qualificação salva!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar qualificação');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        Carregando qualificação...
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="font-semibold text-foreground">Escala de qualificação</h3>
        <p className="text-sm text-muted-foreground">
          Cinco níveis exibidos como estrelas nas negociações. A pontuação máxima de cada
          nível é usada pela qualificação automática via questionários.
        </p>
      </div>

      <div className="space-y-3">
        {levels.map((l) => (
          <div key={l.level} className="flex flex-wrap items-start gap-3">
            <div
              className="flex w-24 shrink-0 items-center gap-0.5 pt-2"
              aria-label={`Nível ${l.level}`}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  size={14}
                  className={i < l.level ? 'fill-primary text-primary' : 'text-muted-foreground'}
                />
              ))}
            </div>
            <div className="min-w-48 flex-1">
              <Input
                value={l.name}
                onChange={(e) => setLevel(l.level, { name: e.target.value })}
                placeholder={`Nome do nível ${l.level}`}
                maxLength={60}
                aria-label={`Nome do nível ${l.level}`}
                error={errors[l.level]}
              />
              {errors[l.level] && (
                <p className="mt-1 text-xs text-destructive">{errors[l.level]}</p>
              )}
            </div>
            <Input
              type="number"
              min={0}
              value={l.maxScoreText}
              onChange={(e) => {
                setLevel(l.level, { maxScoreText: e.target.value });
                if (e.target.value.trim() === '') setAutoQualify(false);
              }}
              placeholder="Pontuação máx."
              className="w-36"
              aria-label={`Pontuação máxima do nível ${l.level}`}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="auto-qualify">Qualificação automática via questionários</Label>
            <p className="text-xs text-muted-foreground">
              Ao salvar uma resposta de questionário, o negócio é qualificado no nível
              correspondente à pontuação.
            </p>
          </div>
          <Switch
            id="auto-qualify"
            checked={autoQualify}
            onCheckedChange={setAutoQualify}
            disabled={anyScoreEmpty}
          />
        </div>
        {anyScoreEmpty && (
          <p className="text-xs text-muted-foreground">
            Defina a pontuação máxima dos 5 níveis para habilitar a qualificação automática.
          </p>
        )}
      </div>

      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
        Salvar
      </Button>
    </div>
  );
}
