import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialData } from "../domain/services/seedData";
import CreateManagementGroupPage from "../pages/CreateManagementGroupPage/CreateManagementGroupPage";

const mocks = vi.hoisted(() => ({ createGroup: vi.fn() }));
vi.mock("../stores/gardenStore", () => ({
  useGardenStore: (selector: (state: unknown) => unknown) => selector({
    data: createInitialData(),
    createGroup: mocks.createGroup
  })
}));

beforeEach(() => {
  mocks.createGroup.mockReset();
  mocks.createGroup.mockResolvedValue({ id: "new-sheet" });
});
afterEach(cleanup);

function renderZone6() {
  render(
    <MemoryRouter initialEntries={["/create"]}>
      <Routes>
        <Route path="/create" element={<CreateManagementGroupPage />} />
        <Route path="/sheets/:id" element={<p>생성된 관리표</p>} />
      </Routes>
    </MemoryRouter>
  );
  fireEvent.change(screen.getByLabelText("Zone"), { target: { value: "zone_6" } });
  fireEvent.click(screen.getByTitle("6-1 선택 가능"));
}

describe("관리그룹 생성 날짜 입력", () => {
  it("빈 날짜 입력란도 날짜 형식을 유지한다", () => {
    renderZone6();
    const input = screen.getByLabelText("관리 시작일");
    expect(input).toHaveAttribute("type", "date");
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(input).toHaveAttribute("type", "date");
  });

  it("존6에서 9월 19일을 선택하고 포커스를 옮겨도 해당 날짜로 생성한다", async () => {
    renderZone6();
    const input = screen.getByLabelText("관리 시작일");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "2026-09-19" } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole("button", { name: "관리그룹 및 관리표 생성" }));
    await waitFor(() => expect(mocks.createGroup).toHaveBeenCalledWith(["bed_6_1"], "2026-09-19"));
    expect(await screen.findByText("생성된 관리표")).toBeInTheDocument();
  });

  it("날짜를 지우면 생성을 막고 다시 선택하면 생성한다", async () => {
    renderZone6();
    const input = screen.getByLabelText("관리 시작일");
    fireEvent.change(input, { target: { value: "2026-09-19" } });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole("button", { name: "관리그룹 및 관리표 생성" }));
    expect(screen.getByText("관리 시작일을 입력해 주세요.")).toBeInTheDocument();
    expect(mocks.createGroup).not.toHaveBeenCalled();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "2026-09-19" } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole("button", { name: "관리그룹 및 관리표 생성" }));
    expect(await screen.findByText("생성된 관리표")).toBeInTheDocument();
    expect(mocks.createGroup).toHaveBeenCalledWith(["bed_6_1"], "2026-09-19");
  });
});
