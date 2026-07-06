import worldPng from "@/rendering/img/world.png";
import valleAostaPng from "@/rendering/img/valle-aosta.png";
import piemontePng from "@/rendering/img/piemonte.png";
import liguriaPng from "@/rendering/img/liguria.png";
import lombardiaPng from "@/rendering/img/lombardia.png";
import trentinoAltoAdigePng from "@/rendering/img/trentino-alto-adige.png";
import venetoPng from "@/rendering/img/veneto.png";
import friuliVeneziaGiuliaPng from "@/rendering/img/friuli-venezia-giulia.png";
import emiliaRomagnaPng from "@/rendering/img/emilia-romagna.png";
import toscanaPng from "@/rendering/img/toscana.png";
import umbriaPng from "@/rendering/img/umbria.png";
import marchePng from "@/rendering/img/marche.png";
import lazioPng from "@/rendering/img/lazio.png";
import abruzzoPng from "@/rendering/img/abruzzo.png";
import molisePng from "@/rendering/img/molise.png";
import campaniaPng from "@/rendering/img/campania.png";
import pugliaPng from "@/rendering/img/puglia.png";
import basilicataPng from "@/rendering/img/basilicata.png";
import calabriaPng from "@/rendering/img/calabria.png";
import siciliaPng from "@/rendering/img/sicilia.png";
import sardegnaPng from "@/rendering/img/sardegna.png";

const imageMap: Record<string, ArrayBuffer> = {
  "world.png": worldPng,
  "valle-aosta.png": valleAostaPng,
  "piemonte.png": piemontePng,
  "liguria.png": liguriaPng,
  "lombardia.png": lombardiaPng,
  "trentino-alto-adige.png": trentinoAltoAdigePng,
  "veneto.png": venetoPng,
  "friuli-venezia-giulia.png": friuliVeneziaGiuliaPng,
  "emilia-romagna.png": emiliaRomagnaPng,
  "toscana.png": toscanaPng,
  "umbria.png": umbriaPng,
  "marche.png": marchePng,
  "lazio.png": lazioPng,
  "abruzzo.png": abruzzoPng,
  "molise.png": molisePng,
  "campania.png": campaniaPng,
  "puglia.png": pugliaPng,
  "basilicata.png": basilicataPng,
  "calabria.png": calabriaPng,
  "sicilia.png": siciliaPng,
  "sardegna.png": sardegnaPng,
};

export function getBaseImage(imageName: string): Uint8Array {
  const buffer = imageMap[imageName];
  if (!buffer) throw new Error(`Image not found: ${imageName}`);
  return new Uint8Array(buffer);
}
