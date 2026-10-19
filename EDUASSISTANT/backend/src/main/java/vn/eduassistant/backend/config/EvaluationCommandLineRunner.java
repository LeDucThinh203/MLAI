package vn.eduassistant.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import vn.eduassistant.backend.core.Json;
import vn.eduassistant.backend.service.BenchmarkService;
import vn.eduassistant.backend.service.HoldoutService;
import vn.eduassistant.backend.service.LiveAiEvaluationService;

/** Runs optional offline Java evaluation commands without starting an HTTP server. */
@Component
public class EvaluationCommandLineRunner implements CommandLineRunner {
    private final BenchmarkService benchmark;
    private final HoldoutService holdout;
    private final LiveAiEvaluationService liveAi;
    @Value("${eduassistant.evaluation:}") private String evaluation;
    public EvaluationCommandLineRunner(BenchmarkService benchmark, HoldoutService holdout, LiveAiEvaluationService liveAi) { this.benchmark=benchmark;this.holdout=holdout;this.liveAi=liveAi; }
    @Override public void run(String... args) throws Exception {
        if("benchmark".equalsIgnoreCase(evaluation))System.out.println(Json.stringify(benchmark.run()));
        else if("holdout".equalsIgnoreCase(evaluation))System.out.println(Json.stringify(holdout.run()));
        else if("live-ai".equalsIgnoreCase(evaluation))System.out.println(Json.stringify(liveAi.run()));
    }
}
