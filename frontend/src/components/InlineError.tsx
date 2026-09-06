interface Props {
  message: string;
}

export function InlineError({ message }: Props) {
  return (
    <p className="error-text" role="alert">
      {message}
    </p>
  );
}