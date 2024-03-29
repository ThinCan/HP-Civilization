import Tile from "../Tile";
import { Civilization } from "../Civiliziations/Civilization";
import Unit from "./Unit";

export interface IEntity {
  Update(): void;
}

export abstract class Entity implements IEntity {
  pos: { x: number; y: number; size: number };

  public selected = false;
  private _tile: Tile

  constructor(
    tile: Tile,
    public img: HTMLImageElement,
    public civ: Civilization
  ) {
    
    this._tile = tile
    this.pos = {
      x: Math.floor(this.tile.pos.x - Tile.size),
      y: Math.floor(this.tile.pos.y - Tile.size * 2),
      size: Tile.size * 2,
    };
    civ.queue.push(this);
  }

  Update() {
    this.Draw();
  }
  abstract Select(): void;
  abstract Deselect(): void;
  abstract isFree(): boolean;
  abstract ReceiveDamage(amount: number): void;
  protected abstract OnTurn(): void;

  NextTurn(select = true): void {
    this.OnTurn();

    if (this.isFree()) this.civ.queue.push(this);
    if (this.selected && select) this.Select();
  }

  private Draw() {
    this.map.c.drawImage(
      this.img,
      this.pos.x,
      this.pos.y,
      this.pos.size,
      this.pos.size
    );
  }
  get map() {
    return this.civ.game.map;
  }
  set tile(t: Tile) {
    this._tile = t;
    this.pos = {
      x: t.pos.x - Tile.size,
      y: t.pos.y - Tile.size * 2,
      size: Tile.size * 2,
    };
  }
  get tile() {
    return this._tile;
  }
  get hashcode() {
    return `${this.pos.x}${this.pos.y}`
  }
}
