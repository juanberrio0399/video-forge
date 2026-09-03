"""Etiqueta (solo informativa) de la licencia de un item de archive.org.

NO bloquea ni descarta nada — solo devuelve un texto corto para mostrar/atribuir,
para que tu veas de un vistazo que es cada video.
"""


def etiqueta(licenseurl: str = "", copyright_status: str = "", rights: str = "") -> str:
    lu = (licenseurl or "").lower()
    cs = (copyright_status or "").lower()
    rt = (rights or "").lower()

    if "publicdomain" in lu or "not_in_copyright" in cs or "public_domain" in cs or "public domain" in rt:
        return "Dominio publico"
    if "by-nc-nd" in lu:
        return "CC BY-NC-ND"
    if "by-nc-sa" in lu:
        return "CC BY-NC-SA"
    if "by-nc" in lu:
        return "CC BY-NC"
    if "by-nd" in lu:
        return "CC BY-ND"
    if "by-sa" in lu:
        return "CC BY-SA"
    if "/by/" in lu:
        return "CC BY"
    if "under_copyright" in cs:
        return "Con copyright"
    return "Sin especificar"
