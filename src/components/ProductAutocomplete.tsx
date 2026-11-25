import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { suggestProducts, type ProductSuggestion } from '../lib/product-suggestions';

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  label: string;
  ariaLabel?: string;
  placeholder?: string;
  required?: boolean;
};

export default function ProductAutocomplete({
  value,
  onChange,
  disabled,
  id,
  label,
  ariaLabel,
  placeholder,
  required,
}: Props) {
  const generatedId = useId();
  const inputId = id ?? `produto-${generatedId}`;
  const listId = `${inputId}-sugestoes`;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const requestNumber = useRef(0);

  useEffect(() => {
    if (!open || disabled) return;
    const current = ++requestNumber.current;
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => {
        setLoading(true);
        void suggestProducts(value, controller.signal)
          .then((rows) => {
            if (current !== requestNumber.current) return;
            setSuggestions(rows);
            setActive(-1);
          })
          .catch((error: unknown) => {
            if ((error as Error).name !== 'AbortError' && current === requestNumber.current)
              setSuggestions([]);
          })
          .finally(() => {
            if (current === requestNumber.current) setLoading(false);
          });
      },
      value.trim() ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [disabled, open, value]);

  function select(suggestion: ProductSuggestion) {
    onChange(suggestion.produto);
    setOpen(false);
    setActive(-1);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      if (suggestions.length) setActive((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (suggestions.length)
        setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter' && open && active >= 0 && suggestions[active]) {
      event.preventDefault();
      select(suggestions[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    } else if (event.key === 'Tab') {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <label className="product-autocomplete" htmlFor={inputId}>
      {label}
      <input
        id={inputId}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        required={required}
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setOpen(false);
        }}
        onChange={(event) => {
          onChange(event.target.value.toLocaleUpperCase('pt-BR'));
          setOpen(true);
        }}
        onKeyDown={keyDown}
      />
      {open && (loading || suggestions.length > 0) && (
        <ul id={listId} role="listbox" className="product-suggestions">
          {loading && !suggestions.length ? (
            <li className="product-suggestion-status">Buscando produtos…</li>
          ) : (
            suggestions.map((suggestion, index) => (
              <li
                id={`${listId}-${index}`}
                key={suggestion.produto}
                role="option"
                aria-selected={index === active}
                className={index === active ? 'active' : ''}
                tabIndex={-1}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => select(suggestion)}
              >
                <span>{suggestion.produto}</span>
                <small>{suggestion.frequencia} uso(s)</small>
              </li>
            ))
          )}
        </ul>
      )}
    </label>
  );
}
