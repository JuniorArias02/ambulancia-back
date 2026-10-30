import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../../common/constants/roles.js';
import { RequiereRoles } from '../../../../common/decorators/requiere_roles.decorator.js';
import { ConsultarTiposAmbulancia } from '../../application/use-cases/consultar_tipos_ambulancia.use-case.js';
import { TipoAmbulanciaRespuestaDto } from '../dto/tipo_ambulancia_respuesta.dto.js';

@ApiTags('Ambulancias')
@ApiBearerAuth()
@Controller('tipos-ambulancia')
export class TiposAmbulanciaController {
  constructor(
    private readonly consultarTiposAmbulancia: ConsultarTiposAmbulancia,
  ) {}

  @Get()
  @RequiereRoles(Roles.ADMINISTRADOR, Roles.DESPACHADOR)
  @ApiOperation({ summary: 'Listar los tipos de ambulancia (TAB, TAM)' })
  @ApiOkResponse({ type: [TipoAmbulanciaRespuestaDto] })
  async listar(): Promise<TipoAmbulanciaRespuestaDto[]> {
    const tipos = await this.consultarTiposAmbulancia.ejecutar();
    return tipos.map((tipo) => TipoAmbulanciaRespuestaDto.desde(tipo));
  }
}
