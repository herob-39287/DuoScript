type VariantsConfig = Record<string, Record<string, string>>;

type VariantSelection<Variants extends VariantsConfig> = {
  [Key in keyof Variants]?: keyof Variants[Key];
} & {
  className?: string;
};

type CVAFunction<Variants extends VariantsConfig> = (
  options?: VariantSelection<Variants>,
) => string;

export type VariantProps<T> = T extends (options?: infer Options) => string ? Options : never;

export const cva = <Variants extends VariantsConfig>(
  base: string,
  config: {
    variants: Variants;
    defaultVariants?: Partial<{ [Key in keyof Variants]: keyof Variants[Key] }>;
  },
): CVAFunction<Variants> => {
  return (options: VariantSelection<Variants> = {}) => {
    const classes = [base];
    const { className, ...selection } = options;
    const selectionMap = selection as Record<string, string | undefined>;

    (Object.keys(config.variants) as Array<keyof Variants>).forEach((key) => {
      const value =
        selectionMap[String(key)] ??
        (config.defaultVariants?.[key] as keyof Variants[typeof key] | undefined);
      if (!value) return;
      const variantClass = config.variants[key][value as string];
      if (variantClass) classes.push(variantClass);
    });

    if (className) classes.push(className);

    return classes.filter(Boolean).join(' ');
  };
};
