import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { UpdateOrderAddressDto } from './update-order-address.dto';

describe('UpdateOrderAddressDto', () => {
  const validAddress = {
    cep: '01310-100',
    street: 'Avenida Paulista',
    neighborhood: 'Bela Vista',
    number: '1000',
    reference: 'Próximo ao metrô',
    city: 'São Paulo',
    state: 'SP',
  };

  it('aceita um endereço de entrega válido', () => {
    expect(
      validateSync(Object.assign(new UpdateOrderAddressDto(), validAddress)),
    ).toHaveLength(0);
  });

  it('rejeita CEP e UF inválidos', () => {
    const dto = Object.assign(new UpdateOrderAddressDto(), validAddress, {
      cep: '123',
      state: 'São Paulo',
    });
    expect(validateSync(dto)).not.toHaveLength(0);
  });
});
