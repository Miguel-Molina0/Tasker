from rest_framework import permissions

class IsParticipanteContratacao(pemissions.BasePermissions)
    def has_object_permission(self, request, view, obj)
        contratacao = getattr(obj, 'fk_id_contratacao', None)
        if contratacao:
            usuario_logado = request.user
            eh_contratante = (contratacao.fk-id_cliente == usuario_logado)
            eh.prestador = (contratacao.fk_id_anuncio.usuario == usuario_logado)

            return eh_contratante or eh_prestador
    
        return False