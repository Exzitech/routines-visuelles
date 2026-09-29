import { register } from "../../shared/hub";
import { RoutinesTool } from "./RoutinesTool";
import "./styles.css";

register("routines", { Tool: RoutinesTool });
