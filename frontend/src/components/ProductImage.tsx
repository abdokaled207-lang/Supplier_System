import { useState } from "react";
import { Package } from "lucide-react";

interface Props {
  imageUrl?: string;
  productName: string;
  size?: number;
  circle?: boolean;
}

export function ProductImage({ imageUrl, productName, size = 24, circle = false }: Props) {
  const [imgError, setImgError] = useState(false);

  if (imageUrl && !imgError) {
    return (
      <>
        <img
          src={imageUrl}
          alt={productName}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          style={{ borderRadius: "4px", objectFit: "cover", flexShrink: 0 }}
          onError={() => setImgError(true)}
        />
        {circle && (
          <span className="product-icon" aria-hidden="true">
            <Package size={13} />
          </span>
        )}
      </>
    );
  }

  if (circle) {
    return (
      <span className="product-icon" aria-hidden="true">
        <Package size={13} />
      </span>
    );
  }

  return <Package size={size} aria-hidden="true" style={{ color: "var(--text-muted)", flexShrink: 0 }} />;
}
