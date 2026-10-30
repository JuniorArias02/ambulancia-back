import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/constants/roles.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import { ConsultarRoles } from '../../application/use-cases/consultar_roles.use-case.js';
import { RolRespuestaDto } from '../dto/rol_respuesta.dto.js';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly consultarRoles: ConsultarRoles) {}

  @Get()
  @RequiereRoles(Roles.ADMINISTRADOR)
  @ApiOperation({ summary: 'Listar los roles disponibles' })
  @ApiOkResponse({ type: [RolRespuestaDto] })
  async listar(): Promise<RolRespuestaDto[]> {
    const roles = await this.consultarRoles.ejecutar();
    return roles.map((rol) => RolRespuestaDto.desde(rol));
  }
}
