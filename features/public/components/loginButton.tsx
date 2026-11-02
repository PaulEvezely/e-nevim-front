import { useNavigate } from "react-router";
import { Button } from "../../../shared/components/Button";

const LoginButton = () => {
  const navigate = useNavigate();
  return (
    <div className="w-full max-w-80 lg:max-w-120 min-w-0">
      <Button
        // className="w-70"
        variant="primary"
        className="h-15 w-full max-w-80 lg:h-35 text-xl lg:max-w-120 lg:text-2xl lg:font-bold "
        // className="h-10 w-70 bg-blue-500 text-white text-base font-medium px-10 py-5 rounded-2xl shadow-lg hover:bg-blue-800 transition-all flex items-center justify-center lg:h-15"
        onClick={() => navigate("/login")}
      >
        ACESSAR CONTA
      </Button>{" "}
    </div>
  );
};

export default LoginButton;
