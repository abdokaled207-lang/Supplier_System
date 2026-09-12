import { useMemo } from "react";
import { Select, createListCollection } from "@ark-ui/react";

export type ArkSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

interface ArkSelectProps {
  options: ArkSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function ArkSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  name,
  required,
  disabled,
  className,
  ariaLabel,
}: ArkSelectProps) {
  const collection = useMemo(
    () =>
      createListCollection({
        items: options,
        itemToValue: (item) => item.value,
        itemToString: (item) => item.label,
        isItemDisabled: (item) => item.disabled ?? false,
      }),
    [options],
  );

  return (
    <Select.Root
      collection={collection}
      value={value ? [value] : []}
      onValueChange={(details) => onChange(details.value[0] ?? "")}
      name={name}
      required={required}
      disabled={disabled}
      className={className ? `ark-select ${className}` : "ark-select"}
    >
      <Select.Control>
        <Select.Trigger aria-label={ariaLabel}>
          <Select.ValueText placeholder={placeholder} />
          <Select.Indicator />
        </Select.Trigger>
      </Select.Control>
      <Select.Positioner>
        <Select.Content>
          <Select.List>
            {collection.items.map((item) => (
              <Select.Item key={item.value} item={item}>
                <Select.ItemText />
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.List>
        </Select.Content>
      </Select.Positioner>
      <Select.HiddenSelect />
    </Select.Root>
  );
}
