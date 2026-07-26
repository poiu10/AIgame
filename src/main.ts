import Phaser from "phaser";
import "./styles.css";
import { gameConfig } from "./phaser/config";
import { mountHud } from "./ui/hud/mountHud";

mountHud(document.querySelector<HTMLDivElement>("#hud"));
new Phaser.Game(gameConfig);
