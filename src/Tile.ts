import Map from "./Map";
import { Astar } from "./Util/Pathfind";
import JSONTileData from "./json/tiledata.json";
import Unit from "./Entity/Unit";
import { IModifier, IAdjTiles, SerializedTile } from "./Util/GlobalInterfaces";
import City from "./Entity/City";

export interface TileData {
  weight: number;
  color: string;
}
export enum TileType {
  Woda,
  Ziemia,
  Skała,
  Śnieg,
  Ciemnaziemia,
  Piasek,
}

interface ISelected {
  color: string;
  entity?: { AcceptTile: (tile: Tile) => void };
}

export default class Tile {
  private _type: TileType;
  private static modifierImgs: globalThis.Map<
    string,
    HTMLImageElement
  > = new globalThis.Map();

  data: TileData;
  pos: { x: number; y: number };
  lines: number[][];

  private _modifier?: IModifier;
  displayModifier = true;

  //is selected
  selected?: ISelected;

  //unit standing on this tile
  private _entity: Unit;
  owner: City;
  private _city: City;

  get city() { return this._city }
  set city(value: City) {
    this._city = value
    if (value.civ === value.civ.game.mainCiv)
      this.SetVisibility(true)
  }

  // If is in sight, display enemy unit
  private _isInSight = false
  get isInSight() { return this._isInSight }
  set isInSight(value: boolean) {
    this._isInSight = value;
    if (value) {
      this.hasBeenInSight = value;
      if (this.city || this.owner) { this.shouldDrawCity = true; }
    }
  }

  // If has been in sight, but is not right now, only draw city
  private _hasBeenInSight = false
  get hasBeenInSight() { return this._hasBeenInSight }
  set hasBeenInSight(value: boolean) { this._hasBeenInSight = value }

  public shouldDrawCity = false


  static size = 75;
  static sizet = Math.floor(Math.sqrt(Tile.size ** 2 - (Tile.size / 2) ** 2));

  constructor(
    public map: Map,
    public mapPos: { x: number; y: number },
    type = TileType.Woda
  ) {
    let x = mapPos.x * Tile.size * 2 + mapPos.x;
    let y = mapPos.y * Tile.sizet * 2 + mapPos.y * 2;
    x -= (Tile.size / 2) * mapPos.x;
    if (mapPos.x % 2 !== 0) y += Tile.sizet * 1.05;
    this.pos = { x: Math.floor(x), y: Math.floor(y) };
    this.type = type;
  }

  Draw() {

    //#region Sprawdz, czy plytka jest widoczna, jesli nie - nie rysuj
    const startX = -this.map.translate.x;
    const startY = -this.map.translate.y;
    const endX = startX + this.map.canvas.width;
    const endY = startY + this.map.canvas.height;
    const sizeX = Tile.size * this.map.scale.x;
    const sizeY = Tile.size * this.map.scale.x;
    if (
      startX - sizeX > this.pos.x * this.map.scale.x ||
      startY - sizeY > (this.pos.y * this.map.scale.y) / 2 ||
      endX + sizeX < this.pos.x * this.map.scale.x ||
      endY + sizeY < (this.pos.y * this.map.scale.y) / 2
    ) {
      return;
    }
    //#endregion

    this.map.c.beginPath();
    const lines: number[][] = [];
    for (let i = 0; i < 7; i++) {
      let x = this.pos.x + Math.cos((Math.PI * i) / 3) * Tile.size;
      let y = this.pos.y + Math.sin((Math.PI * i) / 3) * Tile.size;
      [x, y] = [Math.floor(x), Math.floor(y)];
      this.map.c.lineTo(x, y);

      // Linie do rysowania granic
      if (!this.lines) {
        if (i === 0 || i === 6) x -= 8;
        else if (i === 1 || i === 2) y -= 8;
        else if (i === 4 || i === 5) y += 8;
        else if (i === 3) x += 8;
        lines.push([x, y]);
      }
    }
    if (!this.lines) this.lines = lines;

    if (this.hasBeenInSight) { this.map.c.fillStyle = this.color; }
    else this.map.c.fillStyle = "black"
    this.map.c.fill();


    if (this.hasBeenInSight && this.displayModifier && this._modifier !== undefined) {
      if (Tile.modifierImgs.has(this._modifier.img)) {
        this.map.c.drawImage(
          Tile.modifierImgs.get(this.modifier.img),
          this.pos.x - Tile.sizet,
          this.pos.y - Tile.sizet,
          Tile.sizet * 2,
          Tile.sizet * 2
        );
      }
    }
    if ((this.shouldDrawCity) || this.selected || this.owner && (this.owner.civ.id === this.owner.civ.game.mainCiv.id)) this.DrawBorder();
  }
  DrawBorder() {
    const adj = this.GetNamedAdj();
    const check = (t?: Tile) => {
      if (!t) return false;

      if (
        this.selected &&
        t.selected &&
        t.selected.color !== this.selected.color
      )
        return false;
      if (this.selected && t.selected) return true;

      if (this.owner && t.owner && !t.selected)
        if (this.owner.civ === t.owner.civ) return true;

      return false;
    };
    this.map.c.beginPath();
    this.lines.forEach((e, i) => {
      if (
        (i === 1 && check(adj.br)) ||
        (i === 2 && check(adj.b)) ||
        (i === 3 && check(adj.bl)) ||
        (i === 4 && check(adj.tl)) ||
        (i === 5 && check(adj.t)) ||
        (i === 6 && check(adj.tr))
      ) {
        this.map.c.beginPath();
        return;
      }
      this.map.c.lineWidth = 8;
      if (i === 0) return;

      this.map.c.moveTo(this.lines[i - 1][0], this.lines[i - 1][1]);
      this.map.c.lineTo(e[0], e[1]);

      if (this.selected) this.map.c.strokeStyle = this.selected.color;
      else this.map.c.strokeStyle = this.owner.civ.color;

      this.map.c.stroke();
      this.map.c.beginPath();
    });
  }
  GetAdj(range = 1): Tile[] {
    const res = [];
    for (let y = -range; y <= range; y++)
      for (let x = -range; x <= range; x++) {
        if (x === 0 && y === 0) continue;
        const mx = this.mapPos.x + x;
        const my = this.mapPos.y + y;

        if (this.map.tiles[mx] && this.map.tiles[mx][my])
          res.push(this.map.tiles[mx][my]);
      }
    return res.filter((t) => this.Dist(t) <= Tile.size * 2 * range);
  }
  GetNamedAdj() {
    const res: IAdjTiles = {};
    const adj = this.GetAdj();
    adj.forEach((e) => {
      if (e.pos.x > this.pos.x && this.pos.y > e.pos.y) res.tr = e;
      else if (e.pos.x > this.pos.x && this.pos.y < e.pos.y) res.br = e;
      else if (e.pos.x < this.pos.x && this.pos.y > e.pos.y) res.tl = e;
      else if (e.pos.x < this.pos.x && this.pos.y < e.pos.y) res.bl = e;
      else if (this.pos.y > e.pos.y) res.t = e;
      else if (this.pos.y < e.pos.y) res.b = e;
    });
    return res;
  }
  Dist(target: Tile | { x: number; y: number }) {
    let pos: { x: number; y: number };
    if (target instanceof Tile) {
      pos = target.pos;
    } else pos = target;

    return Math.hypot(this.pos.x - pos.x, this.pos.y - pos.y);
  }
  FindPath(tile: Tile) {
    return Astar.findPath(this, tile);
  }
  MouseClick() {
    if (this.selected) this.selected.entity.AcceptTile(this);
    else if (this.entity?.selected === false) this.entity.Select();
    else if (this.city) this.city.Select();
  }
  Select(data: ISelected) {
    this.selected = data;
  }
  Deselect() {
    delete this.selected;
  }
  Serialize(): SerializedTile {
    return {
      type: this.type,
      pos: this.pos,
      mapPos: this.mapPos,
      displayModifier: this.displayModifier,
      modifier: this._modifier,
    }
  }
  LoadData(data: SerializedTile) {
    this.displayModifier = data.displayModifier
    this.modifier = data.modifier
    this.type = data.type
  }
  SetVisibility(value: boolean) {
    this.isInSight = value
    this.GetAdj(3).forEach(t => t.isInSight = value)
  }
  set type(t: TileType) {
    this._type = t;
    let data!: TileData;

    switch (t) {
      case TileType.Woda:
        data = JSONTileData.Woda;
        break;
      case TileType.Ziemia:
        data = JSONTileData.Ziemia;
        break;
      case TileType.Ciemnaziemia:
        data = JSONTileData.Ciemnaziemia;
        break;
      case TileType.Piasek:
        data = JSONTileData.Piasek;
        break;
      case TileType.Skała:
        data = JSONTileData.Skała;
        break;
      case TileType.Śnieg:
        data = JSONTileData.Śnieg;
        break;

      default:
        throw new Error("Invalid tile type");
    }
    this.data = data;
  }
  get type() {
    return this._type;
  }
  get weight() {
    return this.data.weight + (this.modifier?.weight || 0);
  }
  get modifier() {
    return this._modifier;
  }
  get color() {
    return this.data.color;
  }
  get entity() { return this._entity }
  set entity(value: Unit) {
    if (!value) { delete this._entity; return }
    this._entity = value
    if (value.civ === value.civ.game.mainCiv)
      this.SetVisibility(true)
  }
  set modifier(value: IModifier | undefined) {
    if (value === undefined) {
      delete this._modifier;
      this._modifier = undefined;
      return;
    }
    this._modifier = value

    if (!Tile.modifierImgs.has(value.img)) {
      const img = new Image();
      img.src = `./img/modifiers/${value.img}.png`;
      img.onload = () => {
        Tile.modifierImgs.set(value.img, img);
      };
    }
  }
}
