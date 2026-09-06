import { useEffect, useState } from "react";

interface Props {
  placeholder?: string;
  label: string;
  onSearch: (term: string) => void;
  delay?: number;
}

export function SearchInput({ placeholder = "Search…", label, onSearch, delay = 200 }: Props) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => onSearch(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay, onSearch]);

  return (
    <label className="field">
      {label}
      <input
        className="search-input"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </label>
  );
}