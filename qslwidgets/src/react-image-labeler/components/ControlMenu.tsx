import React from "react";
import {
  Box,
  Button,
  Stack,
  Divider,
  ButtonGroup,
  FormControlLabel,
  Checkbox,
  Tooltip,
  useTheme,
  styled,
} from "@mui/material";
import {
  KeyboardArrowRight,
  KeyboardArrowLeft,
  List,
  Keyboard,
  Add,
} from "@mui/icons-material";
import RangeSlider from "./RangeSlider";
import LabelPanel from "./LabelPanel";
import ConfigEditor from "./ConfigEditor";
import ClickTarget from "./ClickTarget";
import GlobalLabelerContext from "./GlobalLabelerContext";
import Metadata from "./Metadata";
import { shortcutify } from "./library/utils";
import { useKeyboardEvent, useMediaLarge } from "./library/hooks";
import { simulateClick } from "./library/utils";
import { DraftState, Config } from "./library/types";

interface Callbacks {
  onKeyboardEvent?: (event: KeyboardEvent) => void;
  onSave?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onDelete?: () => void;
  onIgnore?: () => void;
  onUnignore?: () => void;
  onSaveConfig?: (config: Config) => void;
  onReset?: () => void;
  onSelectAll?: () => void;
  onSelectNone?: () => void;
  onShowIndex?: () => void;
  onDownload?: () => void;
  onUndo?: () => void;
}

const StyledButton = styled(Button)`
  &.Mui-disabled {
    pointer-events: auto;
  }
`;

const ButtonWithTooltip = React.forwardRef<
  HTMLButtonElement,
  {
    tooltipText?: string;
    disabled: boolean;
    onClick?: () => void;
  } & React.ComponentProps<typeof Button>
>(({ tooltipText, disabled, onClick, ...other }, ref) => {
  const adjustedButtonProps = {
    disabled: disabled,
    component: disabled ? "div" : undefined,
    onClick: disabled ? undefined : onClick,
  };
  return (
    <Tooltip title={tooltipText || ""}>
      <StyledButton ref={ref} {...other} {...adjustedButtonProps} />
    </Tooltip>
  );
});

const ControlMenu: React.FC<{
  config: Config;
  draft: DraftState;
  setDraft: (draft: DraftState) => void;
  callbacks: Callbacks;
  disabled: boolean;
  showNavigation?: boolean;
  allowRegion?: boolean;
  direction: "column" | "row";
}> = ({
  draft,
  disabled,
  callbacks,
  showNavigation,
  setDraft,
  allowRegion = true,
  ...other
}) => {
  const theme = useTheme();
  const refs = Object.fromEntries(
    [
      "next",
      "prev",
      "save",
      "finishRegion",
      "clearRegion",
      "delete",
      "ignore",
      "selectAll",
      "selectNone",
      "undoRegion",
      "undo",
    ].map((key) => [key, React.useRef<HTMLButtonElement>(null)])
  );
  const isLarge = useMediaLarge();
  const computedState = React.useMemo(() => {
    const level = draft.drawing.active ? "regions" : "image";
    const config = {
      image: shortcutify(other.config?.image || []),
      regions: shortcutify(other.config?.regions || []),
    };
    const activeConfig = config[level] || [];
    return {
      level: level as "regions" | "image",
      activeConfig,
      config,
      direction: isLarge ? other.direction : "column",
      allowRegionSelection:
        config?.regions && config.regions.length > 0 && allowRegion,
      disableLabelPanel:
        disabled ||
        (draft.drawing.active !== undefined &&
          draft.drawing.active.region.readonly === true),
      labels: draft.drawing.active
        ? draft.drawing.active.region.labels
        : draft.labels.image,
      editConfig: callbacks?.onSaveConfig
        ? (name: string) =>
            setState({
              configEditorOpen: true,
              index: activeConfig.findIndex((c) => c.name == name),
            })
        : undefined,
    };
  }, [other.config, draft.labels, draft.drawing.active, allowRegion, disabled]);
  const [state, setState] = React.useState({
    configEditorOpen: false,
    index: null as number | null,
  });
  const { setFocus, hasFocus, setToast } =
    React.useContext(GlobalLabelerContext);
  const requiredFieldsFilled = React.useMemo(() => {
    if (draft.drawing.active) {
      return computedState.activeConfig.every(
        (c) =>
          !c.required ||
          (draft.drawing.active!.region.labels[c.name] || []).length > 0
      );
    } else {
      return computedState.activeConfig.every(
        (c) => !c.required || (draft.labels.image[c.name] || []).length > 0
      );
    }
  }, [draft, computedState]);
  const finishRegion = React.useCallback(
    (save) => {
      if (!draft.drawing.active) {
        throw "Called to finish region but no region is selected.";
      }
      setDraft({
        ...draft,
        dirty: true,
        labels: {
          ...draft.labels,
          [draft.drawing.mode]: (save
            ? [draft.drawing.active.region]
            : []
          ).concat(draft.labels[draft.drawing.mode]),
        },
        drawing: {
          ...draft.drawing,
          active: undefined,
        },
      });
    },
    [draft, computedState, setToast, setDraft]
  );
  useKeyboardEvent(
    (event: KeyboardEvent) => {
      if (callbacks?.onKeyboardEvent) {
        callbacks.onKeyboardEvent(event);
      }
      let target: string | null;
      if (event.altKey) {
        return;
      }
      switch (event.key) {
        case "A":
          target = event.ctrlKey && event.shiftKey ? "selectNone" : null;
          break;
        case "a":
          target = event.ctrlKey && !event.shiftKey ? "selectAll" : null;
          break;
        case "z":
          target =
            event.metaKey !== event.ctrlKey
              ? draft.drawing.active
                ? "undoRegion"
                : "undo"
              : null;
          break;
        case "ArrowRight":
          target = event.ctrlKey || event.shiftKey ? null : "next";
          if (draft.dirty && target !== null) {
            setToast(
              "Please save or reset your changes before advancing to next item."
            );
            target = null;
          }
          break;
        case "ArrowLeft":
          target = "prev";
          if (draft.dirty && target !== null) {
            setToast(
              "Please save or reset your changes before returning to previous item."
            );
            target = null;
          }
          break;
        case "Enter":
          target =
            event.ctrlKey || event.shiftKey
              ? null
              : draft.drawing.active
              ? "finishRegion"
              : "save";
          break;
        case "Backspace":
        case "Delete":
          target =
            event.ctrlKey || event.shiftKey
              ? null
              : draft.drawing.active
              ? "clearRegion"
              : "delete";
          break;
        default:
          return;
      }
      if (
        (target == "finishRegion" || target == "save") &&
        !requiredFieldsFilled
      ) {
        setToast("Please fill in all required fields.");
      } else if (target && refs[target].current) {
        simulateClick(refs[target].current).then(setFocus);
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [callbacks, state, draft, refs, setFocus, setToast, requiredFieldsFilled]
  );
  const setLabels = React.useCallback(
    (current) => {
      setDraft({
        ...draft,
        dirty: true,
        labels: draft.drawing.active
          ? draft.labels
          : {
              ...draft.labels,
              image: current,
            },
        drawing: draft.drawing.active
          ? {
              ...draft.drawing,
              active: {
                ...draft.drawing.active,
                region: {
                  ...draft.drawing.active.region,
                  labels: current,
                } as any,
              },
            }
          : draft.drawing,
      });
    },
    [draft, setDraft]
  );
  return (
    <Box>
      <ClickTarget />
      <LabelPanel
        config={computedState.activeConfig}
        disabled={computedState.disableLabelPanel}
        labels={computedState.labels}
        editConfig={computedState.editConfig}
        setLabels={setLabels}
      />
      {draft.drawing && draft.drawing.active?.region.metadata ? (
        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Metadata data={draft.drawing.active.region.metadata} />
        </Box>
      ) : null}
      {Object.keys(
        (draft.drawing.active
          ? computedState.config.regions
          : computedState.config.image) || []
      ).length > 0 ? (
        <Divider sx={{ mb: 3 }} />
      ) : null}
      {computedState.allowRegionSelection ? (
        <Box>
          <Stack alignContent="center" direction={computedState.direction}>
            <Box
              sx={{
                paddingRight: 2,
                borderRight:
                  draft.drawing.mode === "masks"
                    ? `solid 1px ${theme.palette.divider}`
                    : undefined,
              }}
            >
              <LabelPanel
                setLabels={(labels) =>
                  setDraft({
                    ...draft,
                    drawing: {
                      ...draft.drawing,
                      mode: labels.drawingMode[0] as any,
                    },
                  })
                }
                disabled={!!draft.drawing.active || disabled}
                labels={{ drawingMode: [draft.drawing.mode] }}
                config={[
                  {
                    hiderequired: true,
                    required: true,
                    name: "drawingMode",
                    displayName: "Drawing Mode",
                    options: [
                      { name: "boxes", displayName: "Boxes" },
                      { name: "polygons", displayName: "Polygon" },
                      { name: "masks", displayName: "Mask" },
                    ],
                    multiple: false,
                    freeform: false,
                    layout: "row",
                  },
                ]}
              />
            </Box>
            {draft.drawing.mode === "masks" ? (
              <Box
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    computedState.direction == "row"
                      ? `100px 200px 200px`
                      : `100px 200px`,
                  gridTemplateAreas:
                    computedState.direction == "row"
                      ? '"toggle threshold size"'
                      : '"toggle threshold" "size size"',
                  gridTemplateRows: "auto",
                  columnGap: 25,
                }}
              >
                <FormControlLabel
                  style={{ gridArea: "toggle" }}
                  control={
                    <Checkbox
                      checked={draft.drawing.flood}
                      onChange={(event, flood) =>
                        setDraft({
                          ...draft,
                          drawing:
                            draft.drawing.mode === "masks"
                              ? { ...draft.drawing, flood }
                              : draft.drawing,
                        })
                      }
                    />
                  }
                  label={"Flood"}
                />
                <Box style={{ gridArea: "threshold", display: "inline-flex" }}>
                  <RangeSlider
                    name="Flood Threshold"
                    value={draft.drawing.threshold}
                    min={0}
                    disabled={!draft.drawing.flood}
                    max={20}
                    width="100%"
                    aria-label="segmentation mask flood threshold"
                    onValueChange={(value) =>
                      setDraft({
                        ...draft,
                        drawing: {
                          ...draft.drawing,
                          threshold: value as number,
                        },
                      })
                    }
                  />
                </Box>
                <Box style={{ gridArea: "size", display: "inline-flex" }}>
                  <RangeSlider
                    name="Cursor Size"
                    value={draft.drawing.radius}
                    min={1}
                    max={50}
                    width="100%"
                    aria-label="segmentation mask labeling radius"
                    onValueChange={(value) =>
                      setDraft({
                        ...draft,
                        drawing: {
                          ...draft.drawing,
                          radius: value,
                        },
                      })
                    }
                  />
                </Box>
              </Box>
            ) : null}
          </Stack>
          <Divider sx={{ mb: 2, mt: 2 }} />
        </Box>
      ) : null}
      <Stack direction={computedState.direction} spacing={2}>
        {draft.drawing.active ? (
          <ButtonGroup fullWidth size="small" aria-label="region control menu">
            <ButtonWithTooltip
              ref={refs.finishRegion}
              onClick={() => finishRegion(true)}
              startIcon={"\u23CE"}
              disabled={!requiredFieldsFilled}
              className="finish-region"
              tooltipText={
                requiredFieldsFilled
                  ? undefined
                  : "Please fill all required fields."
              }
            >
              {draft.drawing.active.region.readonly ? "Deselect" : "Finish"}
            </ButtonWithTooltip>
            <Button
              startIcon={"\u232B"}
              disabled={draft.drawing.active.region.readonly}
              onClick={() => finishRegion(false)}
              ref={refs.clearRegion}
            >
              Delete
            </Button>
            {callbacks?.onUndo ? (
              <Button
                disabled={disabled}
                onClick={callbacks.onUndo}
                startIcon={"\u2303Z"}
                ref={refs.undoRegion}
              >
                Undo
              </Button>
            ) : null}
          </ButtonGroup>
        ) : (
          <Stack
            direction={computedState.direction}
            spacing={2}
            style={{ width: "100%" }}
          >
            {callbacks?.onSelectAll || callbacks?.onSelectNone ? (
              <ButtonGroup
                fullWidth
                size="small"
                aria-label="selection control menu"
                className="selection-control"
              >
                {callbacks?.onSelectAll ? (
                  <Button
                    disabled={!callbacks?.onSelectAll || disabled}
                    onClick={callbacks?.onSelectAll}
                    startIcon={"\u2303A"}
                    ref={refs.selectAll}
                    className="select-all"
                  >
                    Select All
                  </Button>
                ) : null}
                {callbacks?.onSelectNone ? (
                  <Button
                    disabled={!callbacks?.onSelectNone || disabled}
                    onClick={callbacks?.onSelectNone}
                    startIcon={"\u2303\u21E7A"}
                    ref={refs.selectNone}
                    className="select-none"
                  >
                    Select None
                  </Button>
                ) : null}
              </ButtonGroup>
            ) : null}
            <ButtonGroup fullWidth size="small" aria-label="label control menu">
              <ButtonWithTooltip
                ref={refs.save}
                disabled={
                  !callbacks?.onSave || disabled || !requiredFieldsFilled
                }
                onClick={callbacks?.onSave}
                startIcon={"\u23CE"}
                className="save"
                tooltipText={
                  requiredFieldsFilled
                    ? undefined
                    : "Please fill all required fields."
                }
              >
                Save
              </ButtonWithTooltip>

              {callbacks?.onIgnore || callbacks?.onUnignore ? (
                <Button
                  ref={refs.ignore}
                  disabled={disabled}
                  onClick={callbacks?.onIgnore || callbacks?.onUnignore}
                >
                  {callbacks?.onIgnore ? "Ignore" : "Unignore"}
                </Button>
              ) : null}
              {callbacks?.onDelete ? (
                <Button
                  startIcon={"\u232B"}
                  ref={refs.delete}
                  disabled={disabled}
                  onClick={callbacks.onDelete}
                >
                  Delete
                </Button>
              ) : null}
              {callbacks?.onReset && draft.dirty ? (
                <Button disabled={disabled} onClick={callbacks.onReset}>
                  Reset
                </Button>
              ) : null}
              {callbacks?.onUndo ? (
                <Button
                  disabled={disabled}
                  onClick={callbacks.onUndo}
                  ref={refs.undo}
                  startIcon={"\u2303Z"}
                >
                  Undo
                </Button>
              ) : null}
              {callbacks.onDownload ? (
                <Button onClick={callbacks.onDownload}>Download</Button>
              ) : null}
            </ButtonGroup>
            {callbacks?.onPrev || callbacks?.onNext || showNavigation ? (
              <ButtonGroup
                size="small"
                fullWidth
                aria-label="navigation control menu"
              >
                <Button
                  startIcon={<KeyboardArrowLeft />}
                  ref={refs.prev}
                  disabled={!callbacks?.onPrev || draft.dirty}
                  onClick={callbacks.onPrev}
                >
                  Previous
                </Button>
                <Button
                  startIcon={<KeyboardArrowRight />}
                  ref={refs.next}
                  disabled={!callbacks?.onNext || draft.dirty}
                  onClick={callbacks.onNext}
                >
                  Next
                </Button>
              </ButtonGroup>
            ) : null}
            {callbacks?.onSaveConfig || callbacks?.onShowIndex ? (
              <ButtonGroup
                size="small"
                aria-label="add new configuration menu"
                fullWidth
              >
                {callbacks?.onSaveConfig ? (
                  <Button
                    startIcon={<Add />}
                    className="add-new-label"
                    onClick={() =>
                      setState({ index: null, configEditorOpen: true })
                    }
                  >
                    Add Type
                  </Button>
                ) : null}
                {callbacks?.onShowIndex ? (
                  <Button
                    startIcon={<List />}
                    className="show-data-index"
                    disabled={disabled}
                    onClick={callbacks.onShowIndex}
                  >
                    View Index
                  </Button>
                ) : null}
              </ButtonGroup>
            ) : null}
          </Stack>
        )}
        <Box
          title={
            hasFocus
              ? "Listening for keyboard shortcuts."
              : "Keyboard shortcuts disabled. Click inside the widget to enable."
          }
          onClick={setFocus}
          style={{ zIndex: 1 }}
        >
          <Keyboard
            color={hasFocus ? "primary" : "warning"}
            fontSize={"large"}
          />
        </Box>
      </Stack>
      {callbacks && callbacks.onSaveConfig && state.configEditorOpen ? (
        <ConfigEditor
          allowRegion={allowRegion}
          open={state.configEditorOpen}
          onClose={() => setState({ ...state, configEditorOpen: false })}
          existing={
            state.index !== null
              ? {
                  config: computedState.activeConfig[state.index],
                  level: computedState.level,
                }
              : undefined
          }
          onSave={(newLabelConfig, level) => {
            if (
              state.index === null &&
              (computedState.config[level] || []).find(
                (c) => c.name === newLabelConfig.name
              )
            ) {
              throw "User attempted to add a config with the name of an existing config.";
            }
            const previous = computedState.config[level];
            const index = state.index === null ? previous.length : state.index;
            callbacks.onSaveConfig!({
              ...computedState.config,
              [level]: previous
                .slice(0, index)
                .concat([newLabelConfig])
                .concat(previous.slice(index + 1)),
            });
            setState({ index: null, configEditorOpen: false });
          }}
        />
      ) : null}
    </Box>
  );
};

export default ControlMenu;
