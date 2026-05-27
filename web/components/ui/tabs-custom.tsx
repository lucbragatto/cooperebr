'use client';

/**
 * Tabs custom — Sub-Sprint F.6b Etapa A (M34, 28/05/2026).
 *
 * Implementação leve (sem Shadcn/Radix) pra evitar conflito Base UI vs Radix
 * que pegou no M32 (DialogTrigger asChild). API minimal:
 *
 *   <TabsCustom
 *     tabs={[
 *       { value: 'usinas', label: 'Usinas' },
 *       { value: 'carregadores', label: 'Carregadores', disabled: true, badge: 'Em breve' },
 *     ]}
 *     activeValue={tab}
 *     onChange={setTab}
 *   >
 *     <TabContent value="usinas">...</TabContent>
 *     <TabContent value="carregadores">...</TabContent>
 *   </TabsCustom>
 *
 * Estilo amber theme consistente com Portal Proprietário.
 */

import React from 'react';

export interface TabDef {
  value: string;
  label: string;
  disabled?: boolean;
  badge?: string;
}

interface TabsCustomProps {
  tabs: TabDef[];
  activeValue: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}

export function TabsCustom({ tabs, activeValue, onChange, children }: TabsCustomProps) {
  return (
    <div>
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-1 -mb-px" aria-label="Tabs">
          {tabs.map((t) => {
            const isActive = activeValue === t.value;
            const isDisabled = t.disabled === true;
            return (
              <button
                key={t.value}
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && onChange(t.value)}
                className={[
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                  isActive
                    ? 'border-amber-600 text-amber-700'
                    : isDisabled
                      ? 'border-transparent text-gray-400 cursor-not-allowed'
                      : 'border-transparent text-gray-600 hover:text-amber-700 hover:border-amber-300',
                ].join(' ')}
              >
                {t.label}
                {t.badge && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600 font-medium">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return null;
          const props = child.props as { value?: string };
          if (props.value === activeValue) return child;
          return null;
        })}
      </div>
    </div>
  );
}

interface TabContentProps {
  value: string;
  children: React.ReactNode;
}

export function TabContent({ children }: TabContentProps) {
  return <div>{children}</div>;
}
