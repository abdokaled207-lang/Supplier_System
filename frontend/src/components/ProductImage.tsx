import { useState } from "react";
import { Package } from "lucide-react";

interface Props {
  imageUrl?: string;
  productName: string;
  size?: number;
}

export function ProductImage({ imageUrl, productName, size = 24 }: Props) {
  const [imgError, setImgError] = useState(false);

  if (imageUrl && !imgError) {
    return (
      <img
        src={imageUrl}
        alt={productName}
        width={size}
        height={size}
        style={{ borderRadius: "4px", objectFit: "cover", flexShrink: 0 }}
        onError={() => setImgError(true)}
      />
    );
  }
  return <Package size={size} aria-hidden="true" style={{ color: "var(--text-muted)", flexShrink: 0 }} />;
}
