"use client";

import React from 'react';
import { AlertTriangle, Clock, CheckCircle2, Share2, RefreshCw } from 'lucide-react';

export interface ExpirationAlert {
  id: string;
  documentName: string;
  documentType: string;
  expirationDate: string;
  daysRemaining: number;
  urgency: 'critico' | 'atencao' | 'regular';
  warningMessage: string;
}

interface AlertsPanelProps {
  alerts: ExpirationAlert[];
  onUpdateDocument: (docType: string) => void;
  onNotifyWhatsApp: (alert: ExpirationAlert) => void;
}

export default function AlertsPanel({ alerts, onUpdateDocument, onNotifyWhatsApp }: AlertsPanelProps) {
  const getUrgencyStyles = (urgency: ExpirationAlert['urgency']) => {
    switch (urgency) {
      case 'critico':
        return {
          bg: 'bg-red-50 border-red-200',
          badge: 'bg-red-100 text-red-800 border-red-300',
          icon: <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />,
          dot: 'bg-red-500'
        };
      case 'atencao':
        return {
          bg: 'bg-amber-50 border-amber-200',
          badge: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: <Clock className="text-amber-600 flex-shrink-0" size={20} />,
          dot: 'bg-amber-500'
        };
      case 'regular':
        default:
          return {
            bg: 'bg-green-50 border-green-200',
            badge: 'bg-green-100 text-green-800 border-green-300',
            icon: <CheckCircle2 className="text-green-600 flex-shrink-0" size={20} />,
            dot: 'bg-green-500'
          };
    }
  };

  return (
    <div className="space-y-4">
      {alerts.map((alert) => {
        const styles = getUrgencyStyles(alert.urgency);
        return (
          <div
            key={alert.id}
            className={`border rounded-xl p-5 ${styles.bg} transition-all duration-300 hover:shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}
          >
            <div className="flex items-start gap-4">
              <div className="mt-1">{styles.icon}</div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="font-extrabold text-gray-800 text-sm md:text-base">
                    {alert.documentName}
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${styles.badge} flex items-center gap-1`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                    {alert.urgency === 'critico' ? 'Urgente / Vencido' : alert.urgency === 'atencao' ? 'Atenção' : 'Regular'}
                  </span>
                </div>
                
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  {alert.documentType} • Vence em: <span className="underline">{alert.expirationDate}</span> ({alert.daysRemaining <= 0 ? 'Já Vencido' : `${alert.daysRemaining} dias restantes`})
                </p>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed font-medium">
                  {alert.warningMessage}
                </p>
              </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto justify-end">
              <button
                onClick={() => onNotifyWhatsApp(alert)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-bold transition-all"
                title="Compartilhar status de alerta com o cliente"
              >
                <Share2 size={14} className="text-gray-500" />
                Notificar via WhatsApp
              </button>
              <button
                onClick={() => onUpdateDocument(alert.documentType)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-green text-white hover:brightness-110 text-xs font-bold transition-all shadow-sm"
                title="Iniciar reprocessamento do parecer técnico atualizado"
              >
                <RefreshCw size={14} />
                Atualizar Documento
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
