import Phaser from "phaser";
import { getAuthServiceUrl } from "../config/services";
import { rememberLoginNickname } from "../state/playerIdentity";

export class NicknameScene extends Phaser.Scene {
  private errorMessage?: HTMLDivElement;
  private isLoginInProgress = false;

  constructor() {
    super("NicknameScene");
  }

  create(): void {
    const { width, height } = this.scale;
    
    this.cameras.main.setBackgroundColor("#0a1628");
    
    this.add.text(width / 2, height / 2 - 120, "OCEAN GAME", {
      fontSize: "48px",
      color: "#38bdf8",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.createHtmlForm();
  }

  private createHtmlForm(): void {
    const formContainer = document.createElement("div");
    formContainer.style.position = "absolute";
    formContainer.style.top = "50%";
    formContainer.style.left = "50%";
    formContainer.style.transform = "translate(-50%, -10%)";
    formContainer.style.display = "flex";
    formContainer.style.flexDirection = "column";
    formContainer.style.gap = "12px";
    formContainer.style.alignItems = "center";
    formContainer.style.width = "320px";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Digite seu apelido...";
    input.maxLength = 16;
    input.style.padding = "12px";
    input.style.fontSize = "18px";
    input.style.borderRadius = "8px";
    input.style.border = "2px solid #38bdf8";
    input.style.backgroundColor = "#0f172a";
    input.style.color = "#f8fafc";
    input.style.outline = "none";
    input.style.width = "250px";
    input.style.textAlign = "center";

    const button = document.createElement("button");
    button.innerText = "Entrar";
    button.style.padding = "12px 24px";
    button.style.fontSize = "18px";
    button.style.borderRadius = "8px";
    button.style.border = "none";
    button.style.backgroundColor = "#22c55e";
    button.style.color = "#ffffff";
    button.style.cursor = "pointer";
    button.style.fontWeight = "bold";

    const errorMessage = document.createElement("div");
    errorMessage.style.minHeight = "44px";
    errorMessage.style.maxWidth = "320px";
    errorMessage.style.color = "#fca5a5";
    errorMessage.style.fontSize = "16px";
    errorMessage.style.lineHeight = "20px";
    errorMessage.style.textAlign = "center";
    errorMessage.style.wordBreak = "break-word";
    errorMessage.setAttribute("role", "alert");
    this.errorMessage = errorMessage;

    formContainer.appendChild(input);
    formContainer.appendChild(button);
    formContainer.appendChild(errorMessage);
    document.getElementById("app")?.appendChild(formContainer);

    button.onclick = () =>
      this.handleLogin(input.value.trim(), formContainer, input, button);
    
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleLogin(input.value.trim(), formContainer, input, button);
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      formContainer.remove();
      this.errorMessage = undefined;
    });
  }

  private async handleLogin(
    nickname: string,
    formContainer: HTMLElement,
    input: HTMLInputElement,
    button: HTMLButtonElement
  ): Promise<void> {
    if (this.isLoginInProgress) {
      return;
    }

    this.setError("", input);

    if (!nickname) {
      this.setError("O apelido não pode estar vazio.", input);
      return;
    }

    this.isLoginInProgress = true;
    button.disabled = true;
    button.innerText = "Entrando...";

    try {
      const authUrl = getAuthServiceUrl();
      const response = await fetch(`${authUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.setError(
          errorData.error || errorData.message || "Apelido inválido.",
          input
        );
        return;
      }

      const data = await response.json();
      const normalizedNickname = rememberLoginNickname(data.nickname);

      if (typeof data.token !== "string" || !normalizedNickname) {
        this.setError("Resposta de login inválida.", input);
        return;
      }
      
      sessionStorage.setItem("ocean_token", data.token);

      formContainer.remove();
      this.scene.start("MenuScene");
    } catch (error) {
      this.setError("Serviço de login indisponível", input);
    } finally {
      this.isLoginInProgress = false;

      if (formContainer.isConnected) {
        button.disabled = false;
        button.innerText = "Entrar";
      }
    }
  }

  private setError(message: string, input: HTMLInputElement): void {
    if (this.errorMessage) {
      this.errorMessage.textContent = message;
    }

    input.style.borderColor = message ? "#ef4444" : "#38bdf8";
  }
}
