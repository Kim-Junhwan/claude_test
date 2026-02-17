import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import {
  getAnonWorkData,
  clearAnonWork,
} from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import type { AuthResult } from "@/actions";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

describe("useAuth", () => {
  const mockPush = vi.fn();
  const mockSignInAction = vi.mocked(signInAction);
  const mockSignUpAction = vi.mocked(signUpAction);
  const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
  const mockClearAnonWork = vi.mocked(clearAnonWork);
  const mockGetProjects = vi.mocked(getProjects);
  const mockCreateProject = vi.mocked(createProject);

  beforeEach(() => {
    vi.clearAllMocks();
    const { useRouter } = require("next/navigation");
    vi.mocked(useRouter).mockReturnValue({ push: mockPush });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("signIn", () => {
    describe("happy paths", () => {
      it("should successfully sign in and create project with anonymous work", async () => {
        const mockAnonWork = {
          messages: [{ role: "user", content: "test message" }],
          fileSystemData: { "/": {}, "/test.tsx": {} },
        };
        const mockProject = {
          id: "project-123",
          name: "Design from 10:30:00 AM",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-1",
          messages: "[]",
          data: "{}",
        };

        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(mockAnonWork);
        mockCreateProject.mockResolvedValue(mockProject);

        const { result } = renderHook(() => useAuth());

        const authResult = await result.current.signIn(
          "test@example.com",
          "password123"
        );

        expect(authResult).toEqual({ success: true });
        expect(mockSignInAction).toHaveBeenCalledWith(
          "test@example.com",
          "password123"
        );
        expect(mockGetAnonWorkData).toHaveBeenCalled();
        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^Design from /),
          messages: mockAnonWork.messages,
          data: mockAnonWork.fileSystemData,
        });
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/project-123");
      });

      it("should successfully sign in and navigate to most recent project", async () => {
        const mockProjects = [
          {
            id: "project-456",
            name: "Recent Project",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(null);
        mockGetProjects.mockResolvedValue(mockProjects);

        const { result } = renderHook(() => useAuth());

        const authResult = await result.current.signIn(
          "test@example.com",
          "password123"
        );

        expect(authResult).toEqual({ success: true });
        expect(mockGetProjects).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/project-456");
        expect(mockCreateProject).not.toHaveBeenCalled();
      });

      it("should successfully sign in and create new project when no projects exist", async () => {
        const mockProject = {
          id: "new-project-789",
          name: "New Design #12345",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-1",
          messages: "[]",
          data: "{}",
        };

        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(null);
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue(mockProject);

        const { result } = renderHook(() => useAuth());

        const authResult = await result.current.signIn(
          "test@example.com",
          "password123"
        );

        expect(authResult).toEqual({ success: true });
        expect(mockGetProjects).toHaveBeenCalled();
        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^New Design #/),
          messages: [],
          data: {},
        });
        expect(mockPush).toHaveBeenCalledWith("/new-project-789");
      });

      it("should manage loading state correctly during sign in", async () => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(null);
        mockGetProjects.mockResolvedValue([
          {
            id: "project-1",
            name: "Test",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const { result } = renderHook(() => useAuth());

        expect(result.current.isLoading).toBe(false);

        const signInPromise = result.current.signIn(
          "test@example.com",
          "password123"
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        await signInPromise;
      });
    });

    describe("edge cases", () => {
      it("should not create project when anonymous work has empty messages", async () => {
        const mockAnonWork = {
          messages: [],
          fileSystemData: { "/": {} },
        };
        const mockProjects = [
          {
            id: "project-existing",
            name: "Existing",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(mockAnonWork);
        mockGetProjects.mockResolvedValue(mockProjects);

        const { result } = renderHook(() => useAuth());

        await result.current.signIn("test@example.com", "password123");

        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockClearAnonWork).not.toHaveBeenCalled();
        expect(mockGetProjects).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/project-existing");
      });

      it("should handle anonymous work data with only messages", async () => {
        const mockAnonWork = {
          messages: [{ role: "user", content: "test" }],
          fileSystemData: {},
        };
        const mockProject = {
          id: "project-new",
          name: "Design",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-1",
          messages: "[]",
          data: "{}",
        };

        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(mockAnonWork);
        mockCreateProject.mockResolvedValue(mockProject);

        const { result } = renderHook(() => useAuth());

        await result.current.signIn("test@example.com", "password123");

        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.any(String),
          messages: mockAnonWork.messages,
          data: mockAnonWork.fileSystemData,
        });
        expect(mockClearAnonWork).toHaveBeenCalled();
      });
    });

    describe("error states", () => {
      it("should return error result when sign in fails", async () => {
        const errorResult: AuthResult = {
          success: false,
          error: "Invalid credentials",
        };

        mockSignInAction.mockResolvedValue(errorResult);

        const { result } = renderHook(() => useAuth());

        const authResult = await result.current.signIn(
          "wrong@example.com",
          "wrongpassword"
        );

        expect(authResult).toEqual(errorResult);
        expect(mockGetAnonWorkData).not.toHaveBeenCalled();
        expect(mockGetProjects).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      });

      it("should reset loading state even when sign in fails", async () => {
        mockSignInAction.mockResolvedValue({
          success: false,
          error: "Server error",
        });

        const { result } = renderHook(() => useAuth());

        expect(result.current.isLoading).toBe(false);

        await result.current.signIn("test@example.com", "password123");

        expect(result.current.isLoading).toBe(false);
      });

      it("should reset loading state even when post-signin throws error", async () => {
        mockSignInAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(null);
        mockGetProjects.mockRejectedValue(new Error("Database error"));

        const { result } = renderHook(() => useAuth());

        await expect(
          result.current.signIn("test@example.com", "password123")
        ).rejects.toThrow("Database error");

        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("signUp", () => {
    describe("happy paths", () => {
      it("should successfully sign up and create project with anonymous work", async () => {
        const mockAnonWork = {
          messages: [{ role: "user", content: "signup test" }],
          fileSystemData: { "/": {}, "/component.tsx": {} },
        };
        const mockProject = {
          id: "signup-project-1",
          name: "Design from 11:00:00 AM",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-new",
          messages: "[]",
          data: "{}",
        };

        mockSignUpAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(mockAnonWork);
        mockCreateProject.mockResolvedValue(mockProject);

        const { result } = renderHook(() => useAuth());

        const authResult = await result.current.signUp(
          "new@example.com",
          "newpassword123"
        );

        expect(authResult).toEqual({ success: true });
        expect(mockSignUpAction).toHaveBeenCalledWith(
          "new@example.com",
          "newpassword123"
        );
        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^Design from /),
          messages: mockAnonWork.messages,
          data: mockAnonWork.fileSystemData,
        });
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/signup-project-1");
      });

      it("should successfully sign up and create new project when no anon work", async () => {
        const mockProject = {
          id: "signup-project-2",
          name: "New Design #54321",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-new",
          messages: "[]",
          data: "{}",
        };

        mockSignUpAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(null);
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue(mockProject);

        const { result } = renderHook(() => useAuth());

        const authResult = await result.current.signUp(
          "new@example.com",
          "newpassword123"
        );

        expect(authResult).toEqual({ success: true });
        expect(mockGetProjects).toHaveBeenCalled();
        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^New Design #/),
          messages: [],
          data: {},
        });
        expect(mockPush).toHaveBeenCalledWith("/signup-project-2");
      });

      it("should manage loading state correctly during sign up", async () => {
        mockSignUpAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(null);
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({
          id: "test",
          name: "Test",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-1",
          messages: "[]",
          data: "{}",
        });

        const { result } = renderHook(() => useAuth());

        expect(result.current.isLoading).toBe(false);

        const signUpPromise = result.current.signUp(
          "new@example.com",
          "password123"
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        await signUpPromise;
      });
    });

    describe("error states", () => {
      it("should return error result when email already exists", async () => {
        const errorResult: AuthResult = {
          success: false,
          error: "Email already registered",
        };

        mockSignUpAction.mockResolvedValue(errorResult);

        const { result } = renderHook(() => useAuth());

        const authResult = await result.current.signUp(
          "existing@example.com",
          "password123"
        );

        expect(authResult).toEqual(errorResult);
        expect(mockGetAnonWorkData).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      });

      it("should return error result when password is too short", async () => {
        const errorResult: AuthResult = {
          success: false,
          error: "Password must be at least 8 characters",
        };

        mockSignUpAction.mockResolvedValue(errorResult);

        const { result } = renderHook(() => useAuth());

        const authResult = await result.current.signUp(
          "test@example.com",
          "short"
        );

        expect(authResult).toEqual(errorResult);
        expect(mockPush).not.toHaveBeenCalled();
      });

      it("should reset loading state even when sign up fails", async () => {
        mockSignUpAction.mockResolvedValue({
          success: false,
          error: "Validation error",
        });

        const { result } = renderHook(() => useAuth());

        await result.current.signUp("test@example.com", "password123");

        expect(result.current.isLoading).toBe(false);
      });

      it("should reset loading state even when post-signup throws error", async () => {
        mockSignUpAction.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(null);
        mockGetProjects.mockRejectedValue(new Error("Connection timeout"));

        const { result } = renderHook(() => useAuth());

        await expect(
          result.current.signUp("test@example.com", "password123")
        ).rejects.toThrow("Connection timeout");

        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("hook interface", () => {
    it("should return signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current).toHaveProperty("signIn");
      expect(result.current).toHaveProperty("signUp");
      expect(result.current).toHaveProperty("isLoading");
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });

    it("should initialize with isLoading as false", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("concurrent operations", () => {
    it("should handle multiple concurrent sign in attempts", async () => {
      mockSignInAction.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue(null);
      mockGetProjects.mockResolvedValue([
        {
          id: "project-1",
          name: "Test",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const { result } = renderHook(() => useAuth());

      const promise1 = result.current.signIn("test1@example.com", "pass1");
      const promise2 = result.current.signIn("test2@example.com", "pass2");

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual({ success: true });
      expect(result2).toEqual({ success: true });
      expect(mockSignInAction).toHaveBeenCalledTimes(2);
    });
  });
});
