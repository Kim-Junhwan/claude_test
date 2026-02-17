import { test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MainContent } from "../main-content";

vi.mock("@/lib/contexts/file-system-context", () => ({
  FileSystemProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/lib/contexts/chat-context", () => ({
  ChatProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/chat/ChatInterface", () => ({
  ChatInterface: () => <div data-testid="chat-interface">Chat</div>,
}));

vi.mock("@/components/editor/FileTree", () => ({
  FileTree: () => <div data-testid="file-tree">File Tree</div>,
}));

vi.mock("@/components/editor/CodeEditor", () => ({
  CodeEditor: () => <div data-testid="code-editor">Code Editor</div>,
}));

vi.mock("@/components/preview/PreviewFrame", () => ({
  PreviewFrame: () => <div data-testid="preview-frame">Preview Frame</div>,
}));

vi.mock("@/components/HeaderActions", () => ({
  HeaderActions: () => <div data-testid="header-actions">Header Actions</div>,
}));

test("toggle buttons switch between preview and code views", async () => {
  const user = userEvent.setup();

  render(<MainContent />);

  expect(screen.getByTestId("preview-frame")).toBeInTheDocument();
  expect(screen.queryByTestId("file-tree")).not.toBeInTheDocument();
  expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();

  const codeButton = screen.getByRole("tab", { name: /code/i });
  await user.click(codeButton);

  await waitFor(() => {
    expect(screen.queryByTestId("preview-frame")).not.toBeInTheDocument();
    expect(screen.getByTestId("file-tree")).toBeInTheDocument();
    expect(screen.getByTestId("code-editor")).toBeInTheDocument();
  });

  const previewButton = screen.getByRole("tab", { name: /preview/i });
  await user.click(previewButton);

  await waitFor(() => {
    expect(screen.getByTestId("preview-frame")).toBeInTheDocument();
    expect(screen.queryByTestId("file-tree")).not.toBeInTheDocument();
    expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();
  });
});

test("toggle buttons remain clickable after multiple interactions", async () => {
  const user = userEvent.setup();

  render(<MainContent />);

  const codeButton = screen.getByRole("tab", { name: /code/i });
  const previewButton = screen.getByRole("tab", { name: /preview/i });

  for (let i = 0; i < 5; i++) {
    await user.click(codeButton);
    await waitFor(() => {
      expect(screen.getByTestId("file-tree")).toBeInTheDocument();
    });

    await user.click(previewButton);
    await waitFor(() => {
      expect(screen.getByTestId("preview-frame")).toBeInTheDocument();
    });
  }

  expect(codeButton).toBeEnabled();
  expect(previewButton).toBeEnabled();
});

test("tab triggers have proper accessibility attributes", async () => {
  render(<MainContent />);

  const previewButton = screen.getByRole("tab", { name: /preview/i });
  const codeButton = screen.getByRole("tab", { name: /code/i });

  expect(previewButton).toHaveAttribute("aria-selected", "true");
  expect(codeButton).toHaveAttribute("aria-selected", "false");

  const user = userEvent.setup();
  await user.click(codeButton);

  await waitFor(() => {
    expect(codeButton).toHaveAttribute("aria-selected", "true");
    expect(previewButton).toHaveAttribute("aria-selected", "false");
  });
});
