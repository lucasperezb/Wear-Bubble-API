import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { CreateCouponDto } from './create-coupon.dto';

describe('CreateCouponDto', () => {
  function validatePct(pct: number) {
    const dto = new CreateCouponDto();
    dto.code = 'DESCONTO';
    dto.pct = pct;
    return validateSync(dto);
  }

  it('aceita cupom com 99% de desconto', () => {
    expect(validatePct(99)).toHaveLength(0);
  });

  it('rejeita cupom comum acima de 99%', () => {
    expect(validatePct(100)).not.toHaveLength(0);
  });
});
