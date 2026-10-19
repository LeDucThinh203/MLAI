package vn.eduassistant.backend.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** SPA entry points served when a production frontend build is present. */
@Controller
public class FrontendController {
    @GetMapping({"/", "/login", "/verify", "/verify/{caseId}", "/judge"})
    public String index() { return "forward:/index.html"; }
}
