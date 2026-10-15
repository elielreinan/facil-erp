'use client';

type SearchFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  filters?: Array<{ label: string; value: string; options: string[]; onChange: (value: string) => void }>;
};

export function SearchFilters({ search, onSearchChange, placeholder, filters = [] }: SearchFiltersProps) {
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="table-search">Buscar</label>
        <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" id="table-search" onChange={(event) => onSearchChange(event.target.value)} placeholder={placeholder} type="search" value={search} />
      </div>
      {filters.map((filter) => <div className="sm:w-48" key={filter.label}><label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor={`filter-${filter.label}`}>{filter.label}</label><select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" id={`filter-${filter.label}`} onChange={(event) => filter.onChange(event.target.value)} value={filter.value}><option value="">Todos</option>{filter.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>)}
    </div>
  );
}
