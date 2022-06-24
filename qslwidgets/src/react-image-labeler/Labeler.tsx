import React from "react";
import { Snackbar, Box, IconButton } from "@mui/material";
import HiddenInput from "./components/HiddenInput";
import GlobalLabelerContext from "./components/GlobalLabelerContext";
import CloseIcon from "@mui/icons-material/Close";
import { useInterval } from "./components/library/hooks";

const Labeler: React.FC<
  {
    maxViewHeight?: number;
    useSvelte?: boolean;
  } & React.HTMLAttributes<HTMLDivElement>
> = ({ maxViewHeight = 512, useSvelte = false, children, ...other }) => {
  const refs = {
    hidden: React.useRef<HTMLInputElement>(null),
    container: React.useRef<HTMLElement>(null),
  };
  const [toast, setToast] = React.useState("");
  const [hasFocus, setHasFocus] = React.useState(false);
  const setFocus = React.useCallback(() => {
    if (refs.hidden.current) refs.hidden.current.focus({ preventScroll: true });
  }, [refs.hidden]);
  useInterval(
    () => {
      const updated =
        refs.container.current &&
        refs.container.current.contains(document.activeElement)
          ? true
          : false;
      if (updated !== hasFocus) {
        setHasFocus(updated);
      }
    },
    100,
    true,
    [refs, hasFocus]
  );
  const handleClose = React.useCallback(() => {
    setToast("");
    setFocus();
  }, [setToast, setFocus]);
  return (
    <GlobalLabelerContext.Provider
      value={{
        container: refs.container,
        useSvelte,
        setToast,
        setFocus,
        hasFocus,
        maxViewHeight,
      }}
    >
      <Box
        className="react-image-labeler"
        ref={refs.container}
        style={{ position: "relative" }}
      >
        <Box {...other}>
          {children}
          <HiddenInput ref={refs.hidden} />
          <Snackbar
            sx={{
              position: "absolute",
              height: "100%",
              left: "50%",
            }}
            anchorOrigin={{ horizontal: "center", vertical: "top" }}
            open={toast !== ""}
            autoHideDuration={3000}
            action={
              <React.Fragment>
                <IconButton
                  size="small"
                  aria-label="close"
                  color="inherit"
                  onClick={handleClose}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </React.Fragment>
            }
            onClose={handleClose}
            message={toast}
          />
        </Box>
      </Box>
    </GlobalLabelerContext.Provider>
  );
};

export default Labeler;
