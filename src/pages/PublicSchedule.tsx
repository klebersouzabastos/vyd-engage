import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Loader2, Calendar, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? window.location.origin
    : 'http://localhost:3001');

interface AvailabilityData {
  id: string;
  slug: string;
  title: string;
  duration: number;
  bufferMinutes: number;
  availableHours: Record<string, Array<{ start: string; end: string }>>;
}

const DAY_LABELS: Record<string, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
};

export function PublicSchedule() {
  const { slug } = useParams<{ slug: string }>();
  const [avail, setAvail] = useState<AvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API_BASE}/api/public/schedule/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setAvail(d.data);
      })
      .catch(() => setError('Erro ao carregar agendamento'))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !selectedDate || !selectedTime) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSubmitting(true);
    try {
      const dateTime = `${selectedDate}T${selectedTime}:00`;
      const r = await fetch(`${API_BASE}/api/public/schedule/${slug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, dateTime, message }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erro ao agendar');
      setSuccess(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao agendar reunião');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !avail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{error || 'Link não encontrado'}</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Reunião agendada!</h2>
          <p className="text-gray-500">Você receberá uma confirmação em breve.</p>
        </div>
      </div>
    );
  }

  const activeDays = Object.entries(avail.availableHours)
    .filter(([, slots]) => slots.length > 0)
    .map(([day]) => DAY_LABELS[day] ?? day)
    .join(', ');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{avail.title}</h1>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {avail.duration} min
            </span>
            {activeDays && (
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {activeDays}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="schedule-name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome *
            </label>
            <Input
              id="schedule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              required
            />
          </div>
          <div>
            <label
              htmlFor="schedule-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              E-mail *
            </label>
            <Input
              id="schedule-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div>
            <label htmlFor="schedule-date" className="block text-sm font-medium text-gray-700 mb-1">
              Data *
            </label>
            <Input
              id="schedule-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              required
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <label htmlFor="schedule-time" className="block text-sm font-medium text-gray-700 mb-1">
              Horário *
            </label>
            <Input
              id="schedule-time"
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="schedule-message"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Mensagem (opcional)
            </label>
            <textarea
              id="schedule-message"
              className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Algum contexto sobre a reunião?"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 size={14} className="mr-2 animate-spin" />}
            Confirmar agendamento
          </Button>
        </form>
      </div>
    </div>
  );
}
