export function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="display text-2xl text-blue-deep md:text-3xl">{title}</h2>
      <div className="gold-rule mt-2" />
      {subtitle ? <p className="mt-3 max-w-2xl text-muted">{subtitle}</p> : null}
    </div>
  );
}
