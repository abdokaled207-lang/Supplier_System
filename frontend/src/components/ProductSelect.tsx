import { useMemo } from "react";
import { useProducts } from "../api/hooks";
import { ArkSelect, type ArkSelectOption } from "./ArkSelect";

export function ProductSelect({
  productId,
  onProductIdChange,
}: {
  productId: string;
  onProductIdChange: (productId: string) => void;
}) {
  const { data: products } = useProducts();
  const options = useMemo<ArkSelectOption[]>(
    () =>
      (products?.data ?? []).map((product) => ({
        value: String(product.productId),
        label: `${product.productName} (${product.stockQuantity})`,
      })),
    [products?.data],
  );

  return (
    <ArkSelect
      options={options}
      value={productId}
      onChange={onProductIdChange}
      placeholder="Select product"
      name="productId"
      className="product-picker"
      ariaLabel="Product selection"
    />
  );
}
