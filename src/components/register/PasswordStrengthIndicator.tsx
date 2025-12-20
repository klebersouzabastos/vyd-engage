import React from 'react';
import { Check, X } from 'lucide-react';
import { calculatePasswordStrength, PasswordRequirement } from '../../utils/validation/passwordStrength';
import { cn } from '../ui/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export function PasswordStrengthIndicator({ password, className }: PasswordStrengthIndicatorProps) {
  if (!password) {
    return null;
  }

  const strength = calculatePasswordStrength(password);

  const getColorClasses = () => {
    switch (strength.level) {
      case 'weak':
        return {
          bar: 'bg-red-500',
          text: 'text-red-600',
          bg: 'bg-red-50',
        };
      case 'medium':
        return {
          bar: 'bg-yellow-500',
          text: 'text-yellow-600',
          bg: 'bg-yellow-50',
        };
      case 'strong':
        return {
          bar: 'bg-green-500',
          text: 'text-green-600',
          bg: 'bg-green-50',
        };
      default:
        return {
          bar: 'bg-gray-300',
          text: 'text-gray-600',
          bg: 'bg-gray-50',
        };
    }
  };

  const colors = getColorClasses();

  return (
    <div className={cn('mt-2 space-y-2', className)}>
      {/* Barra de progresso */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className={cn('font-medium', colors.text)}>{strength.label}</span>
          <span className="text-[#6B7280]">{strength.percentage}%</span>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300 ease-out',
              colors.bar
            )}
            style={{ width: `${strength.percentage}%` }}
            role="progressbar"
            aria-valuenow={strength.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Força da senha: ${strength.label}`}
          />
        </div>
      </div>

      {/* Lista de requisitos */}
      <div className={cn('rounded-md p-2 space-y-1.5', colors.bg)}>
        {strength.requirements.map((requirement: PasswordRequirement, index: number) => (
          <div
            key={index}
            className="flex items-center gap-2 text-xs"
          >
            {requirement.met ? (
              <Check
                size={14}
                className={cn('flex-shrink-0', colors.text)}
                aria-hidden="true"
              />
            ) : (
              <X
                size={14}
                className="flex-shrink-0 text-gray-400"
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                requirement.met ? colors.text : 'text-gray-500'
              )}
            >
              {requirement.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}







