export const decimalTransformer = {
  to: (value: number) => value,
  from: (value: string | number) => Number(value),
};
