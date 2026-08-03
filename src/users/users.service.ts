import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  existsByEmail(email: string) {
    return this.repository.existsBy({ email });
  }

  findByEmail(email: string) {
    return this.repository.findOneBy({ email });
  }

  findByUid(uid: string) {
    return this.repository.findOneBy({ uid });
  }

  findAll() {
    return this.repository.find();
  }

  create(data: DeepPartial<UserEntity>) {
    return this.repository.create(data);
  }

  save(user: UserEntity) {
    return this.repository.save(user);
  }

  async delete(uid: string) {
    await this.repository.delete({ uid });
  }
}
