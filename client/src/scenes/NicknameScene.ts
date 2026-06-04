import Phaser from "phaser";

export class NicknameScene extends Phaser.Scene {
  private errorMessage!: Phaser.GameObjects.Text;

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

    this.errorMessage = this.add.text(width / 2, height / 2 + 80, "", {
      fontSize: "18px",
      color: "#ef4444"
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

    formContainer.appendChild(input);
    formContainer.appendChild(button);
    document.getElementById("app")?.appendChild(formContainer);

    button.onclick = () => this.handleLogin(input.value.trim(), formContainer);
    
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.handleLogin(input.value.trim(), formContainer);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      formContainer.remove();
    });
  }

  private async handleLogin(nickname: string, formContainer: HTMLElement): Promise<void> {
    this.errorMessage.setText("");

    if (!nickname) {
      this.errorMessage.setText("O apelido não pode estar vazio.");
      return;
    }

    try {
      const authUrl = import.meta.env.VITE_AUTH_URL || "http://localhost:3004";
      const response = await fetch(`${authUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.errorMessage.setText(errorData.message || "Apelido inválido.");
        return;
      }

      const data = await response.json();
      
      sessionStorage.setItem("ocean_token", data.token);
      sessionStorage.setItem("ocean_nickname", data.nickname);

      formContainer.remove();
      this.scene.start("MenuScene");
    } catch (error) {
      this.errorMessage.setText("Serviço de login indisponível.");
    }
  }
}