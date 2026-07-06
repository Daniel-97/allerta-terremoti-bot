import worldJpg from "@/rendering/img/world.jpg";
import valleAostaJpg from "@/rendering/img/valle-aosta.jpg";
import piemonteJpg from "@/rendering/img/piemonte.jpg";
import liguriaJpg from "@/rendering/img/liguria.jpg";
import lombardiaJpg from "@/rendering/img/lombardia.jpg";
import trentinoAltoAdigeJpg from "@/rendering/img/trentino-alto-adige.jpg";
import venetoJpg from "@/rendering/img/veneto.jpg";
import friuliVeneziaGiuliaJpg from "@/rendering/img/friuli-venezia-giulia.jpg";
import emiliaRomagnaJpg from "@/rendering/img/emilia-romagna.jpg";
import toscanaJpg from "@/rendering/img/toscana.jpg";
import umbriaJpg from "@/rendering/img/umbria.jpg";
import marcheJpg from "@/rendering/img/marche.jpg";
import lazioJpg from "@/rendering/img/lazio.jpg";
import abruzzoJpg from "@/rendering/img/abruzzo.jpg";
import moliseJpg from "@/rendering/img/molise.jpg";
import campaniaJpg from "@/rendering/img/campania.jpg";
import pugliaJpg from "@/rendering/img/puglia.jpg";
import basilicataJpg from "@/rendering/img/basilicata.jpg";
import calabriaJpg from "@/rendering/img/calabria.jpg";
import siciliaJpg from "@/rendering/img/sicilia.jpg";
import sardegnaJpg from "@/rendering/img/sardegna.jpg";

const imageMap: Record<string, ArrayBuffer> = {
  "world.jpg": worldJpg,
  "valle-aosta.jpg": valleAostaJpg,
  "piemonte.jpg": piemonteJpg,
  "liguria.jpg": liguriaJpg,
  "lombardia.jpg": lombardiaJpg,
  "trentino-alto-adige.jpg": trentinoAltoAdigeJpg,
  "veneto.jpg": venetoJpg,
  "friuli-venezia-giulia.jpg": friuliVeneziaGiuliaJpg,
  "emilia-romagna.jpg": emiliaRomagnaJpg,
  "toscana.jpg": toscanaJpg,
  "umbria.jpg": umbriaJpg,
  "marche.jpg": marcheJpg,
  "lazio.jpg": lazioJpg,
  "abruzzo.jpg": abruzzoJpg,
  "molise.jpg": moliseJpg,
  "campania.jpg": campaniaJpg,
  "puglia.jpg": pugliaJpg,
  "basilicata.jpg": basilicataJpg,
  "calabria.jpg": calabriaJpg,
  "sicilia.jpg": siciliaJpg,
  "sardegna.jpg": sardegnaJpg,
};

export function getBaseImage(imageName: string): Uint8Array {
  const buffer = imageMap[imageName];
  if (!buffer) throw new Error(`Image not found: ${imageName}`);
  return new Uint8Array(buffer);
}
