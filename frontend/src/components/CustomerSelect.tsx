import { useMemo } from "react";
import { useCustomers } from "../api/hooks";
import { ArkSelect, type ArkSelectOption } from "./ArkSelect";

export function CustomerSelect({
  customerId,
  onCustomerIdChange,
}: {
  customerId: string;
  onCustomerIdChange: (customerId: string) => void;
}) {
  const { data: customers } = useCustomers();
  const options = useMemo<ArkSelectOption[]>(
    () =>
      (customers?.data ?? []).map((customer) => ({
        value: String(customer.customerId),
        label: customer.fullName,
      })),
    [customers?.data],
  );

  return (
    <ArkSelect
      options={options}
      value={customerId}
      onChange={onCustomerIdChange}
      placeholder="Select customer"
      name="customerId"
      required
      className="customer-picker"
      ariaLabel="Customer selection"
    />
  );
}
